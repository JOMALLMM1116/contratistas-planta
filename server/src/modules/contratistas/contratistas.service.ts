import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import type { Alcance } from '../../shared/seguridad/alcance.js';
import * as empresasService from '../empresas-contratistas/empresas-contratistas.service.js';
import type { ActualizarContratista, CrearContratista, ListarContratistas } from './contratistas.schemas.js';

// Alcance por defecto para llamadas internas entre modulos (el controlador siempre pasa el de la sesion)
const INTERNO: Alcance = { tipo: 'interno' };

const incluir = {
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
} satisfies Prisma.contratistasInclude;

// SEG-01: un supervisor ve los contratistas de su empresa; un contratista, solo su ficha
function filtroAlcance(alcance: Alcance): Prisma.contratistasWhereInput {
  switch (alcance.tipo) {
    case 'interno':
      return {};
    case 'empresa':
      return { empresa_id: alcance.empresaId };
    case 'contratista':
      return { id: alcance.contratistaId };
    default:
      return { id: { in: [] } };
  }
}

export async function listar(filtros: ListarContratistas, alcance: Alcance = INTERNO) {
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

  const condicion: Prisma.contratistasWhereInput = { AND: [where, filtroAlcance(alcance)] };
  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.contratistasOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.contratistas.count({ where: condicion }),
    prisma.contratistas.findMany({ where: condicion, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: string, alcance: Alcance = INTERNO) {
  const contratista = await prisma.contratistas.findFirst({
    where: { AND: [{ id }, filtroAlcance(alcance)] },
    include: incluir,
  });
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
