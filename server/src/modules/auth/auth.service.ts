import type { Request } from 'express';
import { prisma } from '../../shared/db.js';
import { env } from '../../shared/config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { enviarCorreo } from '../../shared/correo.js';
import { hashPassword, verificarPassword } from '../../shared/seguridad/password.js';
import {
  firmarAccessToken,
  generarTokenAleatorio,
  hashToken,
  type UsuarioSesion,
} from '../../shared/seguridad/tokens.js';

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;
const MINUTOS_TOKEN_RECUPERACION = 30;

// Si el correo no existe se verifica contra este hash, para que la respuesta tarde
// lo mismo que con un correo real y no se pueda adivinar que usuarios existen
const hashFicticio = hashPassword('contrasena-ficticia-para-igualar-tiempos');

type UsuarioBase = { id: string; email: string; nombre_completo: string; rol_id: number; empresa_id: string | null };

// Perfil completo: rol, permisos y ficha de contratista (si el usuario es contratista)
async function construirPerfil(usuario: UsuarioBase) {
  const [rol, vinculos, contratista] = await Promise.all([
    prisma.roles.findUniqueOrThrow({
      where: { id: usuario.rol_id },
      select: { codigo: true, nombre: true, es_interno: true },
    }),
    prisma.rol_permisos.findMany({ where: { rol_id: usuario.rol_id }, select: { permiso_id: true } }),
    prisma.contratistas.findUnique({ where: { usuario_id: usuario.id }, select: { id: true } }),
  ]);

  const permisos = await prisma.permisos.findMany({
    where: { id: { in: vinculos.map((v) => v.permiso_id) } },
    select: { codigo: true },
    orderBy: { codigo: 'asc' },
  });

  return {
    id: usuario.id,
    email: usuario.email,
    nombre_completo: usuario.nombre_completo,
    rol,
    permisos: permisos.map((p) => p.codigo),
    empresa_id: usuario.empresa_id,
    contratista_id: contratista?.id ?? null,
  };
}

type Perfil = Awaited<ReturnType<typeof construirPerfil>>;

function aSesion(perfil: Perfil): UsuarioSesion {
  return {
    id: perfil.id,
    email: perfil.email,
    rol: perfil.rol.codigo,
    permisos: perfil.permisos,
    empresa_id: perfil.empresa_id,
    contratista_id: perfil.contratista_id,
  };
}

// Crea la sesion en la base (solo el hash del refresh) y firma el access token
async function abrirSesion(perfil: Perfil, req: Request) {
  const refreshToken = generarTokenAleatorio();
  await prisma.sesiones.create({
    data: {
      usuario_id: perfil.id,
      token_hash: hashToken(refreshToken),
      expira_en: new Date(Date.now() + env.REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000),
      ip: req.ip ?? null,
      user_agent: req.get('user-agent') ?? null,
    },
  });
  const accessToken = await firmarAccessToken(aSesion(perfil));
  return { accessToken, refreshToken };
}

export async function login(email: string, password: string, req: Request) {
  const usuario = await prisma.usuarios.findUnique({ where: { email } });

  if (!usuario) {
    await verificarPassword(await hashFicticio, password);
    await registrarAuditoria(req, {
      accion: 'LOGIN_FALLIDO',
      entidad: 'usuarios',
      resultado: 'denegado',
      datos_despues: { email, motivo: 'usuario inexistente' },
    });
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contrasena incorrectos');
  }

  const quien = { id: usuario.id, email: usuario.email };

  if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) {
    const minutos = Math.ceil((usuario.bloqueado_hasta.getTime() - Date.now()) / 60000);
    await registrarAuditoria(req, {
      accion: 'LOGIN_BLOQUEADO',
      entidad: 'usuarios',
      entidad_id: usuario.id,
      resultado: 'denegado',
      usuario: quien,
    });
    throw new AppError(423, 'USUARIO_BLOQUEADO', `Cuenta bloqueada por intentos fallidos; intente en ${minutos} minuto(s)`);
  }

  if (!(await verificarPassword(usuario.password_hash, password))) {
    const intentos = usuario.intentos_fallidos + 1;
    const bloquear = intentos >= MAX_INTENTOS;

    await prisma.usuarios.update({
      where: { id: usuario.id },
      data: bloquear
        ? { intentos_fallidos: 0, bloqueado_hasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60000) }
        : { intentos_fallidos: intentos },
    });
    await registrarAuditoria(req, {
      accion: 'LOGIN_FALLIDO',
      entidad: 'usuarios',
      entidad_id: usuario.id,
      resultado: 'denegado',
      usuario: quien,
      datos_despues: { intentos, bloqueado: bloquear },
    });

    if (bloquear) {
      throw new AppError(423, 'USUARIO_BLOQUEADO', `Cuenta bloqueada por ${MINUTOS_BLOQUEO} minutos tras ${MAX_INTENTOS} intentos fallidos`);
    }
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contrasena incorrectos');
  }

  if (!usuario.activo) {
    await registrarAuditoria(req, {
      accion: 'LOGIN_FALLIDO',
      entidad: 'usuarios',
      entidad_id: usuario.id,
      resultado: 'denegado',
      usuario: quien,
      datos_despues: { motivo: 'usuario inactivo' },
    });
    throw new AppError(403, 'USUARIO_INACTIVO', 'El usuario esta desactivado');
  }

  await prisma.usuarios.update({
    where: { id: usuario.id },
    data: { intentos_fallidos: 0, bloqueado_hasta: null, ultimo_acceso: new Date() },
  });

  const perfil = await construirPerfil(usuario);
  const tokens = await abrirSesion(perfil, req);
  await registrarAuditoria(req, { accion: 'LOGIN', entidad: 'usuarios', entidad_id: usuario.id, usuario: quien });

  return { perfil, ...tokens };
}

// Rotacion: cada refresh invalida el anterior y entrega uno nuevo
export async function renovar(refreshToken: string | undefined, req: Request) {
  if (!refreshToken) throw new AppError(401, 'NO_AUTENTICADO', 'No hay sesion para renovar');

  const sesion = await prisma.sesiones.findUnique({ where: { token_hash: hashToken(refreshToken) } });
  if (!sesion) throw new AppError(401, 'SESION_INVALIDA', 'La sesion no es valida');

  const usuario = await prisma.usuarios.findUnique({ where: { id: sesion.usuario_id } });
  const quien = usuario ? { id: usuario.id, email: usuario.email } : null;

  // Un refresh ya usado volvio a aparecer: posible robo. Se cierran todas las sesiones del usuario
  if (sesion.revocada_en) {
    await prisma.sesiones.updateMany({
      where: { usuario_id: sesion.usuario_id, revocada_en: null },
      data: { revocada_en: new Date() },
    });
    await registrarAuditoria(req, {
      accion: 'REFRESH_REUTILIZADO',
      entidad: 'sesiones',
      entidad_id: sesion.id,
      resultado: 'denegado',
      usuario: quien,
    });
    throw new AppError(401, 'SESION_INVALIDA', 'Se detecto reutilizacion de la sesion; inicie sesion nuevamente');
  }

  if (sesion.expira_en <= new Date()) {
    throw new AppError(401, 'SESION_EXPIRADA', 'La sesion expiro; inicie sesion nuevamente');
  }
  if (!usuario || !usuario.activo) {
    await prisma.sesiones.update({ where: { id: sesion.id }, data: { revocada_en: new Date() } });
    throw new AppError(401, 'SESION_INVALIDA', 'El usuario ya no esta habilitado');
  }

  // Revocacion condicional: si dos peticiones usan el mismo refresh a la vez, solo una gana
  const { count } = await prisma.sesiones.updateMany({
    where: { id: sesion.id, revocada_en: null },
    data: { revocada_en: new Date() },
  });
  if (count === 0) throw new AppError(401, 'SESION_INVALIDA', 'La sesion ya fue renovada');

  const perfil = await construirPerfil(usuario);
  const tokens = await abrirSesion(perfil, req);
  return { perfil, ...tokens };
}

export async function cerrarSesion(refreshToken: string | undefined, req: Request) {
  if (!refreshToken) return;

  const sesion = await prisma.sesiones.findUnique({ where: { token_hash: hashToken(refreshToken) } });
  if (!sesion || sesion.revocada_en) return;

  await prisma.sesiones.update({ where: { id: sesion.id }, data: { revocada_en: new Date() } });

  const usuario = await prisma.usuarios.findUnique({ where: { id: sesion.usuario_id } });
  await registrarAuditoria(req, {
    accion: 'LOGOUT',
    entidad: 'sesiones',
    entidad_id: sesion.id,
    usuario: usuario ? { id: usuario.id, email: usuario.email } : null,
  });
}

// Perfil fresco desde la base (por si cambiaron rol o permisos desde el login)
export async function perfil(usuarioId: string) {
  const usuario = await prisma.usuarios.findUnique({ where: { id: usuarioId } });
  if (!usuario || !usuario.activo) throw new AppError(401, 'NO_AUTENTICADO', 'El usuario ya no esta habilitado');
  return construirPerfil(usuario);
}

// ---- Recuperacion de contrasena ----

// La respuesta al cliente es la misma exista o no el correo (no revela que usuarios existen)
export async function solicitarRecuperacion(email: string, req: Request) {
  const usuario = await prisma.usuarios.findUnique({ where: { email } });

  if (!usuario || !usuario.activo) {
    await registrarAuditoria(req, {
      accion: 'RECUPERACION_SOLICITADA',
      entidad: 'usuarios',
      resultado: 'denegado',
      datos_despues: { email, motivo: 'usuario inexistente o inactivo' },
    });
    return;
  }

  // Token de un solo uso; en la base solo queda su hash. Los anteriores sin usar se descartan
  const token = generarTokenAleatorio();
  await prisma.$transaction([
    prisma.tokens_recuperacion_password.deleteMany({ where: { usuario_id: usuario.id, usado_en: null } }),
    prisma.tokens_recuperacion_password.create({
      data: {
        usuario_id: usuario.id,
        token_hash: hashToken(token),
        expira_en: new Date(Date.now() + MINUTOS_TOKEN_RECUPERACION * 60000),
      },
    }),
  ]);

  const enlace = `${env.APP_URL}/restablecer?token=${token}`;
  await enviarCorreo(
    usuario.email,
    'Recuperacion de contrasena - Contratistas Planta',
    `Hola ${usuario.nombre_completo}:\n\n` +
      `Para crear una nueva contrasena entra a este enlace:\n${enlace}\n\n` +
      `El enlace vence en ${MINUTOS_TOKEN_RECUPERACION} minutos y solo se puede usar una vez.\n` +
      `Si no solicitaste este cambio, ignora este correo.`,
  );

  await registrarAuditoria(req, {
    accion: 'RECUPERACION_SOLICITADA',
    entidad: 'usuarios',
    entidad_id: usuario.id,
    usuario: { id: usuario.id, email: usuario.email },
  });
}

export async function restablecerPassword(token: string, nueva: string, req: Request) {
  const registro = await prisma.tokens_recuperacion_password.findUnique({ where: { token_hash: hashToken(token) } });

  if (!registro || registro.usado_en || registro.expira_en <= new Date()) {
    await registrarAuditoria(req, {
      accion: 'RESTABLECER_FALLIDO',
      entidad: 'tokens_recuperacion_password',
      entidad_id: registro?.id ?? null,
      resultado: 'denegado',
      datos_despues: { motivo: !registro ? 'token inexistente' : registro.usado_en ? 'token ya usado' : 'token vencido' },
    });
    throw new AppError(400, 'TOKEN_INVALIDO', 'El enlace de recuperacion no es valido o ya vencio');
  }

  const passwordHash = await hashPassword(nueva);
  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    // Marcado condicional: si el mismo token se usa dos veces a la vez, solo una gana
    const { count } = await tx.tokens_recuperacion_password.updateMany({
      where: { id: registro.id, usado_en: null },
      data: { usado_en: ahora },
    });
    if (count === 0) throw new AppError(400, 'TOKEN_INVALIDO', 'El enlace de recuperacion ya fue usado');

    await tx.usuarios.update({
      where: { id: registro.usuario_id },
      data: { password_hash: passwordHash, intentos_fallidos: 0, bloqueado_hasta: null, debe_cambiar_password: false },
    });
    // Por seguridad se cierran todas las sesiones abiertas del usuario
    await tx.sesiones.updateMany({
      where: { usuario_id: registro.usuario_id, revocada_en: null },
      data: { revocada_en: ahora },
    });
  });

  const usuario = await prisma.usuarios.findUnique({ where: { id: registro.usuario_id } });
  await registrarAuditoria(req, {
    accion: 'PASSWORD_RESTABLECIDO',
    entidad: 'usuarios',
    entidad_id: registro.usuario_id,
    usuario: usuario ? { id: usuario.id, email: usuario.email } : null,
  });
}

export async function cambiarPassword(usuarioId: string, actual: string, nueva: string, req: Request) {
  const usuario = await prisma.usuarios.findUnique({ where: { id: usuarioId } });
  if (!usuario || !usuario.activo) throw new AppError(401, 'NO_AUTENTICADO', 'El usuario ya no esta habilitado');

  if (!(await verificarPassword(usuario.password_hash, actual))) {
    await registrarAuditoria(req, {
      accion: 'CAMBIO_PASSWORD_FALLIDO',
      entidad: 'usuarios',
      entidad_id: usuario.id,
      resultado: 'denegado',
    });
    throw new AppError(400, 'PASSWORD_ACTUAL_INCORRECTA', 'La contrasena actual no es correcta');
  }

  await prisma.$transaction([
    prisma.usuarios.update({
      where: { id: usuario.id },
      data: { password_hash: await hashPassword(nueva), debe_cambiar_password: false },
    }),
    prisma.sesiones.updateMany({
      where: { usuario_id: usuario.id, revocada_en: null },
      data: { revocada_en: new Date() },
    }),
  ]);

  await registrarAuditoria(req, { accion: 'PASSWORD_CAMBIADO', entidad: 'usuarios', entidad_id: usuario.id });
}


// Cierra todas las sesiones abiertas de un usuario. La usa el modulo de usuarios
// al desactivarlo, cambiarle el rol o restablecerle la contrasena
export async function cerrarTodasLasSesiones(usuarioId: string) {
  const { count } = await prisma.sesiones.updateMany({
    where: { usuario_id: usuarioId, revocada_en: null },
    data: { revocada_en: new Date() },
  });
  return count;
}
