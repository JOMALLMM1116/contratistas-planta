import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as empresasService from '../empresas-contratistas/empresas-contratistas.service.js';
import type { ActualizarContratista, CrearContratista, ListarContratistas } from './contratistas.schemas.js';

const incluir = {
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
} satisfies Prisma.contratistasInclude;

export async function listar(filtros: ListarContratistas) {
  const where: Prisma.contratistasWhereInput = {};

  if (filtros.buscar) {
    where.OR = [
      { nombres: { contains: filtros.buscar, mode: 'insensitive' } },
      { apellidos: { contains: filtros.buscar, mode: 'insensitive' } },
      { documento_identidad: { contains: filtros.buscar, mode: 'insensitive' } },
      { email: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  if (filtros.empresa_id) where.empresa_id = filtros.empresa_id;
  if (filtros.estado) where.estado = filtros.estado;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.contratistasOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.contratistas.count({ where }),
    prisma.contratistas.findMany({ where, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: string) {
  const contratista = await prisma.contratistas.findUnique({ where: { id }, include: incluir });
  if (!contratista) throw new AppError(404, 'CONTRATISTA_NO_ENCONTRADO', `No existe el contratista ${id}`);
  return contratista;
}

export async function crear(datos: CrearContratista) {
  await empresasService.obtener(datos.empresa_id);
  return prisma.contratistas.create({ data: datos, include: incluir });
}

export async function actualizar(id: string, datos: ActualizarContratista) {
  await obtener(id);
  if (datos.empresa_id) await empresasService.obtener(datos.empresa_id);
  return prisma.contratistas.update({ where: { id }, data: datos, include: incluir });
}

// Borrado logico: documentos, capacitaciones y solicitudes apuntan al contratista
export async function desactivar(id: string) {
  await obtener(id);
  return prisma.contratistas.update({ where: { id }, data: { estado: 'inactivo' }, include: incluir });
}