import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as archivosService from '../archivos/archivos.service.js';
import * as contratistasService from '../contratistas/contratistas.service.js';
import * as empresasService from '../empresas-contratistas/empresas-contratistas.service.js';
import * as solicitudesService from '../solicitudes/solicitudes.service.js';
import * as zonasService from '../zonas/zonas.service.js';
import type {
  ActualizarIncidente,
  CerrarIncidente,
  CrearIncidente,
  InvestigarIncidente,
  ListarIncidentes,
} from './incidentes.schemas.js';

// Sin BigInt (tamano_bytes), que no se serializa a JSON
const incluir = {
  contratistas: { select: { id: true, nombres: true, apellidos: true, documento_identidad: true } },
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
  solicitudes_acceso: { select: { id: true, codigo: true } },
  zonas: { select: { id: true, codigo: true, nombre: true } },
  usuarios_incidentes_reportado_porTousuarios: { select: { id: true, nombre_completo: true, email: true } },
  usuarios_incidentes_cerrado_porTousuarios: { select: { id: true, nombre_completo: true, email: true } },
  incidente_evidencias: {
    include: { archivos: { select: { id: true, nombre_original: true, mime_type: true } } },
  },
} satisfies Prisma.incidentesInclude;

type IncidenteDetalle = Prisma.incidentesGetPayload<{ include: typeof incluir }>;

// Nombres de relacion legibles para el frontend
function formatear(i: IncidenteDetalle) {
  const {
    contratistas,
    empresas_contratistas,
    solicitudes_acceso,
    zonas,
    usuarios_incidentes_reportado_porTousuarios: reportadoPor,
    usuarios_incidentes_cerrado_porTousuarios: cerradoPor,
    incidente_evidencias,
    ...resto
  } = i;

  return {
    ...resto,
    contratista: contratistas,
    empresa: empresas_contratistas,
    solicitud: solicitudes_acceso,
    zona: zonas,
    reportado_por_usuario: reportadoPor,
    cerrado_por_usuario: cerradoPor,
    evidencias: incidente_evidencias.map((e) => e.archivos),
  };
}

async function buscar(id: string) {
  const incidente = await prisma.incidentes.findUnique({ where: { id } });
  if (!incidente) throw new AppError(404, 'INCIDENTE_NO_ENCONTRADO', `No existe el incidente ${id}`);
  return incidente;
}

function exigirEstado(actual: string, permitidos: string[], mensaje: string) {
  if (!permitidos.includes(actual)) {
    throw new AppError(409, 'ESTADO_INVALIDO', `${mensaje} (estado actual: ${actual})`);
  }
}

export async function listar(filtros: ListarIncidentes) {
  const where: Prisma.incidentesWhereInput = {};

  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.severidad) where.severidad = filtros.severidad;
  // Por empresa: los incidentes de la empresa y los de sus contratistas
  if (filtros.empresa_id) {
    where.OR = [{ empresa_id: filtros.empresa_id }, { contratistas: { empresa_id: filtros.empresa_id } }];
  }
  if (filtros.contratista_id) where.contratista_id = filtros.contratista_id;
  if (filtros.desde || filtros.hasta) {
    where.fecha_ocurrencia = {
      ...(filtros.desde ? { gte: filtros.desde } : {}),
      ...(filtros.hasta ? { lte: filtros.hasta } : {}),
    };
  }

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.incidentesOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.incidentes.count({ where }),
    prisma.incidentes.findMany({ where, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos: datos.map(formatear), total };
}

export async function obtener(id: string) {
  const incidente = await prisma.incidentes.findUnique({ where: { id }, include: incluir });
  if (!incidente) throw new AppError(404, 'INCIDENTE_NO_ENCONTRADO', `No existe el incidente ${id}`);
  return formatear(incidente);
}

export async function crear(datos: CrearIncidente) {
  if (datos.contratista_id) await contratistasService.obtener(datos.contratista_id);
  if (datos.empresa_id) await empresasService.obtener(datos.empresa_id);
  if (datos.solicitud_id) await solicitudesService.obtener(datos.solicitud_id);
  if (datos.zona_id) await zonasService.obtener(datos.zona_id);
  for (const archivoId of datos.archivos) await archivosService.obtener(archivoId);

  const { archivos, ...resto } = datos;
  const creado = await prisma.incidentes.create({
    data: { ...resto, incidente_evidencias: { create: archivos.map((archivo_id) => ({ archivo_id })) } },
    include: incluir,
  });
  return formatear(creado);
}

export async function actualizar(id: string, datos: ActualizarIncidente) {
  await buscar(id);
  if (datos.zona_id) await zonasService.obtener(datos.zona_id);

  const actualizado = await prisma.incidentes.update({ where: { id }, data: datos, include: incluir });
  return formatear(actualizado);
}

// Cambio de estado dentro de una transaccion. El trigger de la base escribe el historial
// leyendo app.user_id y app.motivo (set_config local: solo vale para esta transaccion)
async function transicion(
  id: string,
  desde: string,
  hasta: string,
  usuarioId: string,
  motivo: string | null,
  extra: Prisma.incidentesUncheckedUpdateManyInput = {},
) {
  const incidente = await buscar(id);
  exigirEstado(incidente.estado, [desde], `Solo se pasa a ${hasta} un incidente en ${desde}`);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.user_id', ${usuarioId}, true) AS usuario, set_config('app.motivo', ${motivo ?? ''}, true) AS motivo`;
    // El estado esperado va en el where: si otro lo cambio antes, no se actualiza nada
    const { count } = await tx.incidentes.updateMany({ where: { id, estado: desde }, data: { estado: hasta, ...extra } });
    if (count === 0) throw new AppError(409, 'ESTADO_INVALIDO', 'El incidente cambio de estado mientras se procesaba');
  });

  return obtener(id);
}

// abierto -> en_investigacion
export function investigar(id: string, datos: InvestigarIncidente) {
  return transicion(id, 'abierto', 'en_investigacion', datos.usuario_id, datos.motivo ?? null);
}

// en_investigacion -> cerrado
export function cerrar(id: string, datos: CerrarIncidente) {
  return transicion(id, 'en_investigacion', 'cerrado', datos.cerrado_por, datos.motivo ?? null, {
    cerrado_por: datos.cerrado_por,
    cerrado_en: new Date(),
    ...(datos.acciones_correctivas ? { acciones_correctivas: datos.acciones_correctivas } : {}),
  });
}

// Solo se elimina un incidente abierto; si un bloqueo lo referencia, la FK responde 409
export async function eliminar(id: string) {
  const incidente = await buscar(id);
  exigirEstado(incidente.estado, ['abierto'], 'Solo se puede eliminar un incidente abierto');
  return formatear(await prisma.incidentes.delete({ where: { id }, include: incluir }));
}

// ---- Evidencias ----
export async function agregarEvidencia(id: string, archivoId: string) {
  await buscar(id);
  await archivosService.obtener(archivoId);

  // Un archivo repetido en el mismo incidente lo responde el manejador central como 409
  await prisma.incidente_evidencias.create({ data: { incidente_id: id, archivo_id: archivoId } });
  return obtener(id);
}

export async function quitarEvidencia(id: string, archivoId: string) {
  await buscar(id);

  const vinculo = await prisma.incidente_evidencias.findFirst({ where: { incidente_id: id, archivo_id: archivoId } });
  if (!vinculo) throw new AppError(404, 'EVIDENCIA_NO_ENCONTRADA', `El incidente no tiene el archivo ${archivoId}`);

  // Se quita el vinculo; el archivo sigue en el modulo de archivos
  await prisma.incidente_evidencias.delete({ where: { incidente_id_archivo_id: { incidente_id: id, archivo_id: archivoId } } });
  return obtener(id);
}