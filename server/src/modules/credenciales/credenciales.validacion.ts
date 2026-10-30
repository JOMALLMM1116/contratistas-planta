import { errors, jwtVerify } from 'jose';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import * as zonasService from '../zonas/zonas.service.js';
import { AUDIENCIA_CREDENCIAL, EMISOR, SECRETO_CREDENCIAL } from './credenciales.token.js';

export type ResultadoValidacion =
  | 'valido'
  | 'vencido'
  | 'revocado'
  | 'usado'
  | 'invalido'
  | 'bloqueado'
  | 'documentos_vencidos'
  | 'fuera_de_horario'
  | 'zona_no_autorizada';

type Credencial = NonNullable<Awaited<ReturnType<typeof prisma.credenciales.findUnique>>>;

// Busca la credencial por el QR (token firmado) o por el codigo corto
async function resolver(token?: string, codigo?: string) {
  if (codigo) {
    return { credencial: await prisma.credenciales.findUnique({ where: { codigo_corto: codigo } }), tokenVencido: false };
  }

  try {
    const { payload } = await jwtVerify(token!, SECRETO_CREDENCIAL, {
      issuer: EMISOR,
      audience: AUDIENCIA_CREDENCIAL,
      algorithms: ['HS256'],
    });
    const credencial = payload.jti ? await prisma.credenciales.findUnique({ where: { id: payload.jti } }) : null;
    return { credencial, tokenVencido: false };
  } catch (err) {
    // La firma es valida pero ya expiro: se identifica la credencial para responder "vencido"
    if (err instanceof errors.JWTExpired && typeof err.payload.jti === 'string') {
      return { credencial: await prisma.credenciales.findUnique({ where: { id: err.payload.jti } }), tokenVencido: true };
    }
    // Firma invalida, token alterado o no emitido por este sistema
    return { credencial: null, tokenVencido: false };
  }
}

async function cargarDetalle(c: Credencial) {
  const [contratista, solicitud] = await Promise.all([
    prisma.contratistas.findUniqueOrThrow({
      where: { id: c.contratista_id },
      select: { id: true, nombres: true, apellidos: true, documento_identidad: true, empresa_id: true },
    }),
    prisma.solicitudes_acceso.findUniqueOrThrow({
      where: { id: c.solicitud_id },
      select: { id: true, codigo: true, estado: true, descripcion_actividad: true },
    }),
  ]);
  const empresa = await prisma.empresas_contratistas.findUniqueOrThrow({
    where: { id: contratista.empresa_id },
    select: { id: true, nit: true, razon_social: true },
  });
  return { contratista, empresa, solicitud };
}

async function estaBloqueado(contratistaId: string) {
  const [fila] = await prisma.$queryRaw<{ bloqueado: boolean }[]>`SELECT fn_contratista_bloqueado(${contratistaId}::uuid) AS bloqueado`;
  return fila?.bloqueado === true;
}

async function requisitosPendientes(solicitudId: string, contratistaId: string) {
  const filas = await prisma.$queryRaw<{ nombre: string }[]>`SELECT nombre FROM fn_requisitos_incumplidos(${solicitudId}::uuid, ${contratistaId}::uuid)`;
  return filas.map((f) => f.nombre);
}

// Con permiso de trabajo se usa su vigencia; si no, la fecha y horario de la solicitud (hora de Guatemala)
async function estaEnHorario(c: Credencial) {
  if (c.permiso_trabajo_id) {
    const [fila] = await prisma.$queryRaw<{ vigente: boolean }[]>`SELECT fn_permiso_vigente(${c.permiso_trabajo_id}::uuid) AS vigente`;
    return fila?.vigente === true;
  }
  const [fila] = await prisma.$queryRaw<{ en_horario: boolean }[]>`
    SELECT ((now() AT TIME ZONE 'America/Guatemala')::date BETWEEN s.fecha_inicio AND s.fecha_fin
        AND (now() AT TIME ZONE 'America/Guatemala')::time BETWEEN s.hora_inicio AND s.hora_fin) AS en_horario
    FROM solicitudes_acceso s
    WHERE s.id = ${c.solicitud_id}::uuid`;
  return fila?.en_horario === true;
}

export async function evaluarCredencial(datos: { token?: string; codigo?: string; zona_id: number }) {
  const zona = await zonasService.obtener(datos.zona_id);
  if (!zona.activa) throw new AppError(400, 'ZONA_INACTIVA', `La zona ${zona.codigo} esta inactiva`);

  const { credencial, tokenVencido } = await resolver(datos.token, datos.codigo);

  if (!credencial) {
    return {
      resultado: 'invalido' as ResultadoValidacion,
      motivo: datos.codigo ? 'No existe una credencial con ese codigo' : 'El QR no es valido o fue alterado',
      zona,
      credencial: null,
      contratista: null,
      empresa: null,
      solicitud: null,
    };
  }

  const detalle = await cargarDetalle(credencial);
  const fin = (resultado: ResultadoValidacion, motivo: string) => ({ resultado, motivo, zona, credencial, ...detalle });

  if (credencial.estado === 'revocada') {
    return fin('revocado', credencial.motivo_revocacion ?? 'La credencial fue revocada');
  }
  if (credencial.estado === 'usada' || (credencial.usos_maximos !== null && credencial.usos_actuales >= credencial.usos_maximos)) {
    return fin('usado', 'La credencial ya fue utilizada');
  }
  if (tokenVencido || credencial.estado === 'vencida' || credencial.expira_en <= new Date()) {
    return fin('vencido', `La credencial vencio el ${credencial.expira_en.toISOString()}`);
  }
  if (detalle.solicitud.estado !== 'aprobada') {
    return fin('revocado', `La solicitud ${detalle.solicitud.codigo} esta ${detalle.solicitud.estado}`);
  }
  if (await estaBloqueado(credencial.contratista_id)) {
    return fin('bloqueado', 'El contratista o su empresa tienen un bloqueo activo');
  }
  const pendientes = await requisitosPendientes(credencial.solicitud_id, credencial.contratista_id);
  if (pendientes.length > 0) {
    return fin('documentos_vencidos', `Requisitos pendientes o vencidos: ${pendientes.join(', ')}`);
  }
  if (!(await estaEnHorario(credencial))) {
    return fin('fuera_de_horario', 'Fuera de la fecha u horario autorizado');
  }
  const zonaAutorizada = await prisma.solicitud_zonas.count({
    where: { solicitud_id: credencial.solicitud_id, zona_id: zona.id },
  });
  if (zonaAutorizada === 0) {
    return fin('zona_no_autorizada', `La solicitud no autoriza el ingreso a ${zona.codigo} (${zona.nombre})`);
  }

  return fin('valido', 'Acceso autorizado');
}

export type Evaluacion = Awaited<ReturnType<typeof evaluarCredencial>>;
