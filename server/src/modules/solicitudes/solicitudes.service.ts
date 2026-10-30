import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as contratistasService from '../contratistas/contratistas.service.js';
import * as empresasService from '../empresas-contratistas/empresas-contratistas.service.js';
import * as equiposService from '../equipos/equipos.service.js';
import * as tiposTrabajoService from '../tipos-trabajo/tipos-trabajo.service.js';
import * as zonasService from '../zonas/zonas.service.js';
import type {
  ActualizarSolicitud,
  AutorizarSolicitud,
  CancelarSolicitud,
  CrearSolicitud,
  EnviarSolicitud,
  EvaluarSolicitud,
  ListarSolicitudes,
} from './solicitudes.schemas.js';

// Etapas de autorizacion que exige cada nivel de riesgo (ajustar aqui si cambia la regla)
const ETAPAS_REQUERIDAS: Record<string, number> = { bajo: 1, medio: 1, alto: 2, critico: 2 };

type Faltante = { tipo: string; referencia_id: number | null; nombre: string; motivo: string };

const incluirDetalle = {
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
  tipos_trabajo: {
    select: { id: true, codigo: true, nombre: true, requiere_permiso_trabajo: true, requiere_evaluacion_riesgo: true },
  },
  solicitud_contratistas: {
    select: { contratistas: { select: { id: true, nombres: true, apellidos: true, documento_identidad: true } } },
  },
  solicitud_zonas: { select: { zonas: { select: { id: true, codigo: true, nombre: true, nivel_riesgo: true } } } },
  solicitud_equipos: { select: { equipos: { select: { id: true, codigo: true, nombre: true } } } },
  evaluaciones_riesgo: { orderBy: { created_at: 'desc' } },
  autorizaciones: { orderBy: { etapa: 'asc' } },
} satisfies Prisma.solicitudes_accesoInclude;

const incluirResumen = {
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
  tipos_trabajo: { select: { id: true, codigo: true, nombre: true } },
  _count: { select: { solicitud_contratistas: true, solicitud_zonas: true } },
} satisfies Prisma.solicitudes_accesoInclude;

// Las columnas TIME salen como fecha ISO; se devuelven como "HH:MM"
const hhmm = (d: Date) => d.toISOString().slice(11, 16);

function formatear<T extends { hora_inicio: Date; hora_fin: Date }>(solicitud: T) {
  return { ...solicitud, hora_inicio: hhmm(solicitud.hora_inicio), hora_fin: hhmm(solicitud.hora_fin) };
}

async function buscar(id: string) {
  const solicitud = await prisma.solicitudes_acceso.findUnique({ where: { id } });
  if (!solicitud) throw new AppError(404, 'SOLICITUD_NO_ENCONTRADA', `No existe la solicitud ${id}`);
  return solicitud;
}

function exigirEstado(actual: string, permitidos: string[], mensaje: string) {
  if (!permitidos.includes(actual)) {
    throw new AppError(409, 'ESTADO_INVALIDO', `${mensaje} (estado actual: ${actual})`);
  }
}

// Cambia el estado dentro de la transaccion. El trigger de la base escribe el historial
// leyendo app.user_id y app.motivo (set_config local: solo vale para esta transaccion)
async function cambiarEstado(
  tx: Prisma.TransactionClient,
  id: string,
  estado: string,
  usuarioId: string | null,
  motivo: string | null,
  extra: Prisma.solicitudes_accesoUncheckedUpdateInput = {},
) {
  await tx.$queryRaw`SELECT set_config('app.user_id', ${usuarioId ?? ''}, true) AS usuario, set_config('app.motivo', ${motivo ?? ''}, true) AS motivo`;
  return tx.solicitudes_acceso.update({ where: { id }, data: { estado, ...extra } });
}

async function estaBloqueado(contratistaId: string) {
  const [fila] = await prisma.$queryRaw<{ bloqueado: boolean }[]>`SELECT fn_contratista_bloqueado(${contratistaId}::uuid) AS bloqueado`;
  return fila?.bloqueado === true;
}

// Documentos y capacitaciones que le faltan a cada contratista de la solicitud
async function faltantesPorContratista(solicitudId: string) {
  const vinculos = await prisma.solicitud_contratistas.findMany({
    where: { solicitud_id: solicitudId },
    include: { contratistas: { select: { id: true, nombres: true, apellidos: true } } },
  });

  const resultado: { contratista_id: string; nombre: string; faltantes: Faltante[] }[] = [];
  for (const { contratistas: c } of vinculos) {
    const faltantes = await prisma.$queryRaw<Faltante[]>`SELECT tipo, referencia_id, nombre, motivo FROM fn_requisitos_incumplidos(${solicitudId}::uuid, ${c.id}::uuid)`;
    resultado.push({ contratista_id: c.id, nombre: `${c.nombres} ${c.apellidos}`, faltantes });
  }
  return resultado;
}

async function exigirRequisitos(solicitudId: string) {
  const incumplen = (await faltantesPorContratista(solicitudId)).filter((x) => x.faltantes.length > 0);
  if (incumplen.length > 0) {
    throw new AppError(409, 'REQUISITOS_INCUMPLIDOS', 'Hay contratistas con documentos o capacitaciones pendientes', incumplen);
  }
}

// Contratistas y equipos deben ser de la empresa de la solicitud; las zonas, activas
async function validarVinculos(
  empresaId: string,
  v: { contratistas?: string[]; zonas?: number[]; equipos?: string[] },
) {
  for (const id of v.contratistas ?? []) {
    const contratista = await contratistasService.obtener(id);
    if (contratista.empresa_id !== empresaId) {
      throw new AppError(400, 'CONTRATISTA_OTRA_EMPRESA', `El contratista ${id} no pertenece a la empresa de la solicitud`);
    }
  }
  for (const id of v.equipos ?? []) {
    const equipo = await equiposService.obtener(id);
    if (equipo.empresa_id !== empresaId) {
      throw new AppError(400, 'EQUIPO_OTRA_EMPRESA', `El equipo ${id} no pertenece a la empresa de la solicitud`);
    }
  }
  for (const id of v.zonas ?? []) {
    const zona = await zonasService.obtener(id);
    if (!zona.activa) throw new AppError(400, 'ZONA_INACTIVA', `La zona ${zona.codigo} esta inactiva`);
  }
}

export async function listar(filtros: ListarSolicitudes) {
  const where: Prisma.solicitudes_accesoWhereInput = {};

  if (filtros.buscar) {
    where.OR = [
      { codigo: { contains: filtros.buscar, mode: 'insensitive' } },
      { descripcion_actividad: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.empresa_id) where.empresa_id = filtros.empresa_id;
  if (filtros.tipo_trabajo_id !== undefined) where.tipo_trabajo_id = filtros.tipo_trabajo_id;
  if (filtros.zona_id !== undefined) where.solicitud_zonas = { some: { zona_id: filtros.zona_id } };
  if (filtros.contratista_id) where.solicitud_contratistas = { some: { contratista_id: filtros.contratista_id } };
  if (filtros.desde) where.fecha_fin = { gte: filtros.desde };
  if (filtros.hasta) where.fecha_inicio = { lte: filtros.hasta };

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.solicitudes_accesoOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.solicitudes_acceso.count({ where }),
    prisma.solicitudes_acceso.findMany({ where, orderBy, include: incluirResumen, ...paginar(filtros) }),
  ]);

  return { datos: datos.map((s) => formatear(s)), total };
}

export async function obtener(id: string) {
  const solicitud = await prisma.solicitudes_acceso.findUnique({ where: { id }, include: incluirDetalle });
  if (!solicitud) throw new AppError(404, 'SOLICITUD_NO_ENCONTRADA', `No existe la solicitud ${id}`);
  return formatear(solicitud);
}

export async function requisitos(id: string) {
  await buscar(id);
  return faltantesPorContratista(id);
}

export async function crear(datos: CrearSolicitud) {
  const empresa = await empresasService.obtener(datos.empresa_id);
  if (empresa.estado !== 'activa') {
    throw new AppError(409, 'EMPRESA_INACTIVA', 'La empresa esta inactiva y no puede solicitar accesos');
  }
  const tipo = await tiposTrabajoService.obtener(datos.tipo_trabajo_id);
  if (!tipo.activo) throw new AppError(400, 'TIPO_TRABAJO_INACTIVO', `El tipo de trabajo ${tipo.codigo} esta inactivo`);
  await validarVinculos(datos.empresa_id, datos);

  const { contratistas, zonas, equipos, ...resto } = datos;
  const creada = await prisma.solicitudes_acceso.create({
    data: {
      ...resto,
      solicitud_contratistas: { create: contratistas.map((contratista_id) => ({ contratista_id })) },
      solicitud_zonas: { create: zonas.map((zona_id) => ({ zona_id })) },
      solicitud_equipos: { create: equipos.map((equipo_id) => ({ equipo_id })) },
    },
    include: incluirDetalle,
  });
  return formatear(creada);
}

export async function actualizar(id: string, datos: ActualizarSolicitud) {
  const solicitud = await buscar(id);
  exigirEstado(solicitud.estado, ['borrador'], 'Solo se puede editar una solicitud en borrador');

  const inicio = datos.fecha_inicio ?? solicitud.fecha_inicio;
  const fin = datos.fecha_fin ?? solicitud.fecha_fin;
  if (fin < inicio) throw new AppError(400, 'FECHAS_INVALIDAS', 'La fecha fin no puede ser anterior a la de inicio');

  const horaInicio = datos.hora_inicio ?? solicitud.hora_inicio;
  const horaFin = datos.hora_fin ?? solicitud.hora_fin;
  if (horaFin <= horaInicio) throw new AppError(400, 'HORAS_INVALIDAS', 'La hora fin debe ser posterior a la de inicio');

  if (datos.tipo_trabajo_id !== undefined) {
    const tipo = await tiposTrabajoService.obtener(datos.tipo_trabajo_id);
    if (!tipo.activo) throw new AppError(400, 'TIPO_TRABAJO_INACTIVO', `El tipo de trabajo ${tipo.codigo} esta inactivo`);
  }
  await validarVinculos(solicitud.empresa_id, datos);

  const { contratistas, zonas, equipos, ...resto } = datos;
  const data: Prisma.solicitudes_accesoUncheckedUpdateInput = { ...resto };
  if (contratistas) {
    data.solicitud_contratistas = { deleteMany: {}, create: contratistas.map((contratista_id) => ({ contratista_id })) };
  }
  if (zonas) data.solicitud_zonas = { deleteMany: {}, create: zonas.map((zona_id) => ({ zona_id })) };
  if (equipos) data.solicitud_equipos = { deleteMany: {}, create: equipos.map((equipo_id) => ({ equipo_id })) };

  const actualizada = await prisma.solicitudes_acceso.update({ where: { id }, data, include: incluirDetalle });
  return formatear(actualizada);
}

export async function enviar(id: string, datos: EnviarSolicitud) {
  const solicitud = await buscar(id);
  exigirEstado(solicitud.estado, ['borrador'], 'Solo se puede enviar una solicitud en borrador');

  const vinculos = await prisma.solicitud_contratistas.findMany({
    where: { solicitud_id: id },
    include: { contratistas: { select: { id: true, nombres: true, apellidos: true, estado: true } } },
  });
  if (vinculos.length === 0) throw new AppError(400, 'SIN_CONTRATISTAS', 'La solicitud no tiene contratistas');

  const zonas = await prisma.solicitud_zonas.count({ where: { solicitud_id: id } });
  if (zonas === 0) throw new AppError(400, 'SIN_ZONAS', 'La solicitud no tiene zonas');

  const problemas: { contratista_id: string; nombre: string; motivo: string }[] = [];
  for (const { contratistas: c } of vinculos) {
    const nombre = `${c.nombres} ${c.apellidos}`;
    if (c.estado !== 'activo') {
      problemas.push({ contratista_id: c.id, nombre, motivo: 'contratista inactivo' });
    } else if (await estaBloqueado(c.id)) {
      problemas.push({ contratista_id: c.id, nombre, motivo: 'contratista bloqueado' });
    }
  }
  if (problemas.length > 0) {
    throw new AppError(409, 'CONTRATISTAS_NO_HABILITADOS', 'Hay contratistas que no pueden ingresar', problemas);
  }

  await prisma.$transaction((tx) => cambiarEstado(tx, id, 'pendiente', datos.usuario_id ?? null, null));
  return obtener(id);
}

export async function evaluar(id: string, datos: EvaluarSolicitud) {
  const solicitud = await buscar(id);
  exigirEstado(solicitud.estado, ['pendiente', 'en_revision'], 'Solo se evalua una solicitud pendiente o en revision');

  await prisma.$transaction(async (tx) => {
    await tx.evaluaciones_riesgo.create({ data: { solicitud_id: id, ...datos } });

    if (datos.resultado === 'rechazada') {
      await cambiarEstado(tx, id, 'rechazada', datos.evaluador_id, 'Evaluacion de riesgo rechazada', {
        motivo_rechazo: 'Evaluacion de riesgo rechazada',
      });
    } else if (solicitud.estado === 'pendiente') {
      await cambiarEstado(tx, id, 'en_revision', datos.evaluador_id, null);
    }
  });

  return obtener(id);
}

export async function autorizar(id: string, datos: AutorizarSolicitud) {
  const solicitud = await buscar(id);
  exigirEstado(solicitud.estado, ['pendiente', 'en_revision'], 'Solo se autoriza una solicitud pendiente o en revision');

  const tipo = await tiposTrabajoService.obtener(solicitud.tipo_trabajo_id);
  const evaluacion = await prisma.evaluaciones_riesgo.findFirst({
    where: { solicitud_id: id },
    orderBy: { created_at: 'desc' },
  });
  if (tipo.requiere_evaluacion_riesgo && !evaluacion) {
    throw new AppError(409, 'EVALUACION_REQUERIDA', 'Este tipo de trabajo exige evaluacion de riesgo antes de autorizar');
  }

  const previas = await prisma.autorizaciones.findMany({ where: { solicitud_id: id } });
  if (previas.some((a) => a.usuario_id === datos.usuario_id)) {
    throw new AppError(409, 'AUTORIZADOR_REPETIDO', 'La misma persona no puede autorizar dos etapas de una solicitud');
  }

  const etapa = previas.length + 1;
  const requeridas = ETAPAS_REQUERIDAS[evaluacion?.nivel_riesgo ?? 'medio'] ?? 1;
  const esUltima = datos.decision === 'aprobada' && etapa >= requeridas;

  // Antes de dar la aprobacion final se verifican documentos y capacitaciones
  if (esUltima) await exigirRequisitos(id);

  await prisma.$transaction(async (tx) => {
    await tx.autorizaciones.create({
      data: { solicitud_id: id, etapa, decision: datos.decision, usuario_id: datos.usuario_id, comentario: datos.comentario ?? null },
    });

    if (datos.decision === 'rechazada') {
      await cambiarEstado(tx, id, 'rechazada', datos.usuario_id, datos.comentario ?? null, {
        motivo_rechazo: datos.comentario ?? null,
      });
    } else if (esUltima) {
      await cambiarEstado(tx, id, 'aprobada', datos.usuario_id, datos.comentario ?? null);
    } else if (solicitud.estado === 'pendiente') {
      await cambiarEstado(tx, id, 'en_revision', datos.usuario_id, null);
    }
  });

  return obtener(id);
}

export async function cancelar(id: string, datos: CancelarSolicitud) {
  const solicitud = await buscar(id);
  exigirEstado(solicitud.estado, ['borrador', 'pendiente', 'en_revision'], 'Solo se cancela una solicitud sin decision final');

  await prisma.$transaction((tx) => cambiarEstado(tx, id, 'cancelada', datos.usuario_id ?? null, datos.motivo));
  return obtener(id);
}

// Solo los borradores se eliminan; las demas quedan como registro (se cancelan)
export async function eliminar(id: string) {
  const solicitud = await buscar(id);
  exigirEstado(solicitud.estado, ['borrador'], 'Solo se puede eliminar una solicitud en borrador');
  return formatear(await prisma.solicitudes_acceso.delete({ where: { id } }));
}