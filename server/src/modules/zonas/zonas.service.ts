import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import type { ActualizarZona, CrearZona, ListarZonas } from './zonas.schemas.js';

// Regla del monolito modular: otros modulos NO consultan la tabla zonas
// directamente; llaman a estas funciones.

export async function listar(filtros: ListarZonas) {
  const where: Prisma.zonasWhereInput = {};

  if (filtros.buscar) {
    where.OR = [
      { codigo: { contains: filtros.buscar, mode: 'insensitive' } },
      { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  if (filtros.activa !== undefined) where.activa = filtros.activa;
  if (filtros.nivel_riesgo !== undefined) where.nivel_riesgo = filtros.nivel_riesgo;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.zonasOrderByWithRelationInput;

  // Conteo y pagina en una sola transaccion para que sean consistentes
  const [total, datos] = await prisma.$transaction([
    prisma.zonas.count({ where }),
    prisma.zonas.findMany({ where, orderBy, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: number) {
  const zona = await prisma.zonas.findUnique({ where: { id } });
  if (!zona) throw new AppError(404, 'ZONA_NO_ENCONTRADA', `No existe la zona ${id}`);
  return zona;
}

export async function crear(datos: CrearZona) {
  return prisma.zonas.create({ data: datos });
}

export async function actualizar(id: number, datos: ActualizarZona) {
  await obtener(id);
  return prisma.zonas.update({ where: { id }, data: datos });
}

// Borrado logico: la zona queda inactiva pero se conserva para el historial
export async function desactivar(id: number) {
  await obtener(id);
  return prisma.zonas.update({ where: { id }, data: { activa: false } });
}
