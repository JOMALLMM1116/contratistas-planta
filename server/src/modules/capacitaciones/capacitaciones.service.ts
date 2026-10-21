import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import type {
  ActualizarCapacitacion,
  CrearCapacitacion,
  ListarCapacitaciones,
} from './capacitaciones.schemas.js';

export async function listar(filtros: ListarCapacitaciones) {
  const where: Prisma.capacitacionesWhereInput = {};

  if (filtros.buscar) {
    where.OR = [
      { codigo: { contains: filtros.buscar, mode: 'insensitive' } },
      { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.capacitacionesOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.capacitaciones.count({ where }),
    prisma.capacitaciones.findMany({ where, orderBy, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: number) {
  const capacitacion = await prisma.capacitaciones.findUnique({ where: { id } });
  if (!capacitacion) throw new AppError(404, 'CAPACITACION_NO_ENCONTRADA', `No existe la capacitacion ${id}`);
  return capacitacion;
}

export async function crear(datos: CrearCapacitacion) {
  return prisma.capacitaciones.create({ data: datos });
}

export async function actualizar(id: number, datos: ActualizarCapacitacion) {
  await obtener(id);
  return prisma.capacitaciones.update({ where: { id }, data: datos });
}

// Sin campo "activo" en la tabla: borrado real. Si esta en uso, la FK responde 409
export async function eliminar(id: number) {
  await obtener(id);
  return prisma.capacitaciones.delete({ where: { id } });
}