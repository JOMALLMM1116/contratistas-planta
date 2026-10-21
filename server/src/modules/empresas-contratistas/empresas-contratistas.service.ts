import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import type { ActualizarEmpresa, CrearEmpresa, ListarEmpresas } from './empresas-contratistas.schemas.js';

// Cantidad de contratistas y equipos de la empresa
const incluir = {
  _count: { select: { contratistas: true, equipos: true } },
} satisfies Prisma.empresas_contratistasInclude;

export async function listar(filtros: ListarEmpresas) {
  const where: Prisma.empresas_contratistasWhereInput = {};

  if (filtros.buscar) {
    where.OR = [
      { nit: { contains: filtros.buscar, mode: 'insensitive' } },
      { razon_social: { contains: filtros.buscar, mode: 'insensitive' } },
      { nombre_contacto: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  if (filtros.estado) where.estado = filtros.estado;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.empresas_contratistasOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.empresas_contratistas.count({ where }),
    prisma.empresas_contratistas.findMany({ where, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: string) {
  const empresa = await prisma.empresas_contratistas.findUnique({ where: { id }, include: incluir });
  if (!empresa) throw new AppError(404, 'EMPRESA_NO_ENCONTRADA', `No existe la empresa ${id}`);
  return empresa;
}

export async function crear(datos: CrearEmpresa) {
  return prisma.empresas_contratistas.create({ data: datos, include: incluir });
}

export async function actualizar(id: string, datos: ActualizarEmpresa) {
  await obtener(id);
  return prisma.empresas_contratistas.update({ where: { id }, data: datos, include: incluir });
}

// Borrado logico: solicitudes, documentos e incidentes apuntan a la empresa
export async function desactivar(id: string) {
  await obtener(id);
  return prisma.empresas_contratistas.update({ where: { id }, data: { estado: 'inactiva' }, include: incluir });
}