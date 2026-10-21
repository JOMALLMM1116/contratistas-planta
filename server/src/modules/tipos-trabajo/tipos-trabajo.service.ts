import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import type { ActualizarTipoTrabajo, CrearTipoTrabajo, ListarTiposTrabajo } from './tipos-trabajo.schemas.js';

export async function listar(filtros: ListarTiposTrabajo) {
  const where: Prisma.tipos_trabajoWhereInput = {};

  if (filtros.buscar) {
    where.OR = [
      { codigo: { contains: filtros.buscar, mode: 'insensitive' } },
      { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  if (filtros.activo !== undefined) where.activo = filtros.activo;
  if (filtros.requiere_permiso_trabajo !== undefined) {
    where.requiere_permiso_trabajo = filtros.requiere_permiso_trabajo;
  }

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.tipos_trabajoOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.tipos_trabajo.count({ where }),
    prisma.tipos_trabajo.findMany({ where, orderBy, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: number) {
  const tipo = await prisma.tipos_trabajo.findUnique({ where: { id } });
  if (!tipo) throw new AppError(404, 'TIPO_TRABAJO_NO_ENCONTRADO', `No existe el tipo de trabajo ${id}`);
  return tipo;
}

export async function crear(datos: CrearTipoTrabajo) {
  return prisma.tipos_trabajo.create({ data: datos });
}

export async function actualizar(id: number, datos: ActualizarTipoTrabajo) {
  await obtener(id);
  return prisma.tipos_trabajo.update({ where: { id }, data: datos });
}

// Borrado logico: se conserva para las solicitudes que ya lo usan
export async function desactivar(id: number) {
  await obtener(id);
  return prisma.tipos_trabajo.update({ where: { id }, data: { activo: false } });
}