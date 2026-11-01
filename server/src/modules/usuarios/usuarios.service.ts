import { randomInt } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import { hashPassword } from '../../shared/seguridad/password.js';
import * as authService from '../auth/auth.service.js';
import * as rolesService from '../roles/roles.service.js';
import type { ActualizarUsuario, CrearUsuario, ListarUsuarios } from './usuarios.schemas.js';

// password_hash NUNCA se selecciona: ninguna respuesta puede incluirlo
const select = {
  id: true,
  email: true,
  nombre_completo: true,
  activo: true,
  debe_cambiar_password: true,
  ultimo_acceso: true,
  created_at: true,
  updated_at: true,
  rol_id: true,
  empresa_id: true,
  roles: { select: { id: true, codigo: true, nombre: true, es_interno: true } },
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
} satisfies Prisma.usuariosSelect;

type UsuarioPublico = Prisma.usuariosGetPayload<{ select: typeof select }>;

// Resumen que se guarda en la auditoria (sin datos sensibles)
function resumen(u: UsuarioPublico) {
  return { nombre_completo: u.nombre_completo, rol: u.roles.codigo, empresa_id: u.empresa_id, activo: u.activo };
}

// Regla: un rol externo exige empresa; un rol interno nunca pertenece a una empresa contratista
function empresaSegunRol(rol: { es_interno: boolean }, empresaId: string | null) {
  if (rol.es_interno) return null;
  if (!empresaId) throw new AppError(400, 'EMPRESA_REQUERIDA', 'Un rol externo exige empresa_id');
  return empresaId;
}

// Evita que un administrador se deje a si mismo sin acceso o sin privilegios
function noSobreSiMismo(id: string, solicitanteId: string, mensaje: string) {
  if (id === solicitanteId) throw new AppError(409, 'OPERACION_SOBRE_SI_MISMO', mensaje);
}

// Contrasena temporal aleatoria de 12 caracteres, sin caracteres ambiguos
const MAYUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUS = 'abcdefghijkmnopqrstuvwxyz';
const NUMEROS = '23456789';

function elegir(origen: string) {
  return origen.charAt(randomInt(origen.length));
}

function generarPasswordTemporal() {
  const todos = MAYUS + MINUS + NUMEROS;
  const c = [elegir(MAYUS), elegir(MINUS), elegir(NUMEROS)];
  while (c.length < 12) c.push(elegir(todos));
  for (let i = c.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = c[i] as string;
    c[i] = c[j] as string;
    c[j] = tmp;
  }
  return c.join('');
}

export async function listar(filtros: ListarUsuarios) {
  const where: Prisma.usuariosWhereInput = {};

  if (filtros.buscar) {
    where.OR = [
      { nombre_completo: { contains: filtros.buscar, mode: 'insensitive' } },
      { email: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  if (filtros.rol_id !== undefined) where.rol_id = filtros.rol_id;
  if (filtros.activo !== undefined) where.activo = filtros.activo;
  if (filtros.empresa_id) where.empresa_id = filtros.empresa_id;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.usuariosOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.usuarios.count({ where }),
    prisma.usuarios.findMany({ where, orderBy, select, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: string) {
  const usuario = await prisma.usuarios.findUnique({ where: { id }, select });
  if (!usuario) throw new AppError(404, 'USUARIO_NO_ENCONTRADO', `No existe el usuario ${id}`);
  return usuario;
}

export async function crear(datos: CrearUsuario) {
  const rol = await rolesService.obtener(datos.rol_id);
  const empresaId = empresaSegunRol(rol, datos.empresa_id ?? null);

  // Un correo repetido lo responde el manejador central como 409
  return prisma.usuarios.create({
    data: {
      email: datos.email,
      nombre_completo: datos.nombre_completo,
      rol_id: datos.rol_id,
      empresa_id: empresaId,
      password_hash: await hashPassword(datos.password),
    },
    select,
  });
}

// solicitanteId: el usuario de la sesion que hace el cambio
export async function actualizar(id: string, datos: ActualizarUsuario, solicitanteId: string) {
  const actual = await obtener(id);
  const cambiaRol = datos.rol_id !== undefined && datos.rol_id !== actual.rol_id;
  const desactiva = datos.activo === false && actual.activo;

  if (cambiaRol || datos.activo === false) {
    noSobreSiMismo(id, solicitanteId, 'No puede desactivar ni cambiar el rol de su propia cuenta');
  }

  const rol = await rolesService.obtener(datos.rol_id ?? actual.rol_id);
  const empresaId = empresaSegunRol(rol, datos.empresa_id !== undefined ? datos.empresa_id : actual.empresa_id);

  const usuario = await prisma.usuarios.update({
    where: { id },
    data: { nombre_completo: datos.nombre_completo, rol_id: rol.id, empresa_id: empresaId, activo: datos.activo },
    select,
  });

  // Desactivado o con otro rol: se cierran sus sesiones para que el cambio aplique de inmediato
  const sesionesCerradas = cambiaRol || desactiva ? await authService.cerrarTodasLasSesiones(id) : 0;

  return { usuario, antes: resumen(actual), despues: resumen(usuario), sesionesCerradas };
}

// Pone una contrasena temporal y obliga a cambiarla; se devuelve una sola vez
export async function restablecerPassword(id: string, solicitanteId: string) {
  noSobreSiMismo(id, solicitanteId, 'Para su propia cuenta use la opcion de cambiar contrasena');
  await obtener(id);

  const temporal = generarPasswordTemporal();
  const usuario = await prisma.usuarios.update({
    where: { id },
    data: {
      password_hash: await hashPassword(temporal),
      debe_cambiar_password: true,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    },
    select,
  });

  // Quien tuviera una sesion abierta con la contrasena anterior queda fuera
  const sesionesCerradas = await authService.cerrarTodasLasSesiones(id);

  return { usuario, password_temporal: temporal, sesionesCerradas };
}
