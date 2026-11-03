import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import type { Alcance } from '../../shared/seguridad/alcance.js';
import * as empresasService from '../empresas-contratistas/empresas-contratistas.service.js';
import type { ActualizarEquipo, CrearEquipo, ListarEquipos } from './equipos.schemas.js';

// Alcance por defecto para llamadas internas entre modulos (el controlador siempre pasa el de la sesion)
const INTERNO: Alcance = { tipo: 'interno' };

const incluir = {
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
} satisfies Prisma.equiposInclude;

// SEG-01: un externo solo ve los equipos de su empresa
function filtroAlcance(alcance: Alcance): Prisma.equiposWhereInput {
  switch (alcance.tipo) {
    case 'interno':
      return {};
    case 'empresa':
      return { empresa_id: alcance.empresaId };
    case 'contratista':
      // La empresa del contratista es la que contiene su ficha
      return { empresas_contratistas: { contratistas: { some: { id: alcance.contratistaId } } } };
    default:
      return { id: { in: [] } };
  }
}

export async function listar(filtros: ListarEquipos, alcance: Alcance = INTERNO) {
  const where: Prisma.equiposWhereInput = {};

  if (filtros.buscar) {
    where.OR = [
      { codigo: { contains: filtros.buscar, mode: 'insensitive' } },
      { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
      { numero_serie: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  if (filtros.empresa_id) where.empresa_id = filtros.empresa_id;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.tipo) where.tipo = { contains: filtros.tipo, mode: 'insensitive' };

  const condicion: Prisma.equiposWhereInput = { AND: [where, filtroAlcance(alcance)] };
  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.equiposOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.equipos.count({ where: condicion }),
    prisma.equipos.findMany({ where: condicion, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: string, alcance: Alcance = INTERNO) {
  const equipo = await prisma.equipos.findFirst({
    where: { AND: [{ id }, filtroAlcance(alcance)] },
    include: incluir,
  });
  if (!equipo) throw new AppError(404, 'EQUIPO_NO_ENCONTRADO', `No existe el equipo ${id}`);
  return equipo;
}

export async function crear(datos: CrearEquipo) {
  await empresasService.obtener(datos.empresa_id);
  return prisma.equipos.create({ data: datos, include: incluir });
}

export async function actualizar(id: string, datos: ActualizarEquipo) {
  await obtener(id);
  if (datos.empresa_id) await empresasService.obtener(datos.empresa_id);
  return prisma.equipos.update({ where: { id }, data: datos, include: incluir });
}

// Borrado logico: documentos y solicitudes apuntan al equipo
export async function desactivar(id: string) {
  await obtener(id);
  return prisma.equipos.update({ where: { id }, data: { estado: 'inactivo' }, include: incluir });
}
