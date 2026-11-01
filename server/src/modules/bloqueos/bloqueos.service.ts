import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as contratistasService from '../contratistas/contratistas.service.js';
import * as empresasService from '../empresas-contratistas/empresas-contratistas.service.js';
import type { CrearBloqueo, LevantarBloqueo, ListarBloqueos } from './bloqueos.schemas.js';

const incluir = {
  contratistas: { select: { id: true, nombres: true, apellidos: true, documento_identidad: true } },
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
  incidentes: { select: { id: true, codigo: true, severidad: true, estado: true } },
  usuarios_bloqueos_creado_porTousuarios: { select: { id: true, nombre_completo: true, email: true } },
  usuarios_bloqueos_levantado_porTousuarios: { select: { id: true, nombre_completo: true, email: true } },
} satisfies Prisma.bloqueosInclude;

type BloqueoDetalle = Prisma.bloqueosGetPayload<{ include: typeof incluir }>;

// Nombres de relacion legibles para el frontend; "activo" = todavia no se levanta
function formatear(b: BloqueoDetalle) {
  const {
    contratistas,
    empresas_contratistas,
    incidentes,
    usuarios_bloqueos_creado_porTousuarios: creadoPor,
    usuarios_bloqueos_levantado_porTousuarios: levantadoPor,
    ...resto
  } = b;

  return {
    ...resto,
    activo: b.levantado_en === null,
    contratista: contratistas,
    empresa: empresas_contratistas,
    incidente: incidentes,
    creado_por_usuario: creadoPor,
    levantado_por_usuario: levantadoPor,
  };
}

export async function listar(filtros: ListarBloqueos) {
  const where: Prisma.bloqueosWhereInput = {};

  if (filtros.activo !== undefined) where.levantado_en = filtros.activo ? null : { not: null };
  if (filtros.tipo) where.tipo = filtros.tipo;
  if (filtros.empresa_id) where.empresa_id = filtros.empresa_id;
  if (filtros.contratista_id) where.contratista_id = filtros.contratista_id;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.bloqueosOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.bloqueos.count({ where }),
    prisma.bloqueos.findMany({ where, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos: datos.map(formatear), total };
}

export async function obtener(id: string) {
  const bloqueo = await prisma.bloqueos.findUnique({ where: { id }, include: incluir });
  if (!bloqueo) throw new AppError(404, 'BLOQUEO_NO_ENCONTRADO', `No existe el bloqueo ${id}`);
  return formatear(bloqueo);
}

export async function crear(datos: CrearBloqueo) {
  if (datos.contratista_id) await contratistasService.obtener(datos.contratista_id);
  if (datos.empresa_id) await empresasService.obtener(datos.empresa_id);

  // El incidente se verifica contra la tabla: este modulo no depende del de incidentes
  if (datos.incidente_id) {
    const incidente = await prisma.incidentes.findUnique({ where: { id: datos.incidente_id }, select: { id: true } });
    if (!incidente) throw new AppError(404, 'INCIDENTE_NO_ENCONTRADO', `No existe el incidente ${datos.incidente_id}`);
  }

  const creado = await prisma.bloqueos.create({ data: datos, include: incluir });
  return formatear(creado);
}

export async function levantar(id: string, datos: LevantarBloqueo) {
  const bloqueo = await prisma.bloqueos.findUnique({ where: { id }, select: { id: true, levantado_en: true } });
  if (!bloqueo) throw new AppError(404, 'BLOQUEO_NO_ENCONTRADO', `No existe el bloqueo ${id}`);
  if (bloqueo.levantado_en) throw new AppError(409, 'BLOQUEO_YA_LEVANTADO', 'El bloqueo ya fue levantado');

  // levantado_en en el where: si otro lo levanto antes, no se actualiza nada
  const { count } = await prisma.bloqueos.updateMany({
    where: { id, levantado_en: null },
    data: { levantado_por: datos.levantado_por, levantado_en: new Date(), motivo_levantamiento: datos.motivo },
  });
  if (count === 0) throw new AppError(409, 'BLOQUEO_YA_LEVANTADO', 'El bloqueo ya fue levantado');

  return obtener(id);
}