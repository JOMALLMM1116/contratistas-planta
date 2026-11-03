import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as tiposTrabajoService from '../tipos-trabajo/tipos-trabajo.service.js';
import type {
  ActualizarItem,
  ActualizarPlantilla,
  CrearItem,
  CrearPlantilla,
  ListarPlantillas,
} from './checklist-plantillas.schemas.js';

const tipoTrabajoResumen = { select: { id: true, codigo: true, nombre: true } };

// Listado: resumen y cantidad de items
const incluirResumen = {
  tipos_trabajo: tipoTrabajoResumen,
  _count: { select: { checklist_items: true } },
} satisfies Prisma.checklist_plantillasInclude;

// Detalle: items ordenados
const incluirDetalle = {
  tipos_trabajo: tipoTrabajoResumen,
  checklist_items: { orderBy: { orden: 'asc' } },
} satisfies Prisma.checklist_plantillasInclude;

export async function listar(filtros: ListarPlantillas) {
  const where: Prisma.checklist_plantillasWhereInput = {};

  if (filtros.buscar) where.nombre = { contains: filtros.buscar, mode: 'insensitive' };
  if (filtros.tipo_trabajo_id !== undefined) where.tipo_trabajo_id = filtros.tipo_trabajo_id;
  if (filtros.activa !== undefined) where.activa = filtros.activa;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.checklist_plantillasOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.checklist_plantillas.count({ where }),
    prisma.checklist_plantillas.findMany({ where, orderBy, include: incluirResumen, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: number) {
  const plantilla = await prisma.checklist_plantillas.findUnique({ where: { id }, include: incluirDetalle });
  if (!plantilla) throw new AppError(404, 'PLANTILLA_NO_ENCONTRADA', `No existe la plantilla ${id}`);
  return plantilla;
}

export async function crear(datos: CrearPlantilla) {
  await tiposTrabajoService.obtener(datos.tipo_trabajo_id);

  const { items, ...plantilla } = datos;
  return prisma.checklist_plantillas.create({
    data: {
      ...plantilla,
      checklist_items: {
        create: items.map((item, i) => ({ ...item, orden: i + 1 })),
      },
    },
    include: incluirDetalle,
  });
}

export async function actualizar(id: number, datos: ActualizarPlantilla) {
  await obtener(id);
  if (datos.tipo_trabajo_id !== undefined) await tiposTrabajoService.obtener(datos.tipo_trabajo_id);
  return prisma.checklist_plantillas.update({ where: { id }, data: datos, include: incluirDetalle });
}

// Borrado logico: las respuestas de checklist ya registradas apuntan a sus items
export async function desactivar(id: number) {
  await obtener(id);
  return prisma.checklist_plantillas.update({ where: { id }, data: { activa: false }, include: incluirDetalle });
}

// ---- Items ----
async function obtenerItem(plantillaId: number, itemId: number) {
  const item = await prisma.checklist_items.findFirst({ where: { id: itemId, plantilla_id: plantillaId } });
  if (!item) {
    throw new AppError(404, 'ITEM_NO_ENCONTRADO', `La plantilla ${plantillaId} no tiene el item ${itemId}`);
  }
  return item;
}

export async function agregarItem(plantillaId: number, datos: CrearItem) {
  await obtener(plantillaId);

  let orden = datos.orden;
  if (orden === undefined) {
    const { _max } = await prisma.checklist_items.aggregate({
      where: { plantilla_id: plantillaId },
      _max: { orden: true },
    });
    orden = (_max.orden ?? 0) + 1;
  }

  return prisma.checklist_items.create({
    data: { plantilla_id: plantillaId, descripcion: datos.descripcion, obligatorio: datos.obligatorio, orden },
  });
}

export async function actualizarItem(plantillaId: number, itemId: number, datos: ActualizarItem) {
  await obtenerItem(plantillaId, itemId);
  return prisma.checklist_items.update({ where: { id: itemId }, data: datos });
}

// Borrado real: si el item ya tiene respuestas, la FK responde 409
export async function eliminarItem(plantillaId: number, itemId: number) {
  await obtenerItem(plantillaId, itemId);
  return prisma.checklist_items.delete({ where: { id: itemId } });
}