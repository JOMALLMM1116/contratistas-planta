import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as capacitacionesService from '../capacitaciones/capacitaciones.service.js';
import * as tiposDocumentoService from '../tipos-documento/tipos-documento.service.js';
import * as tiposTrabajoService from '../tipos-trabajo/tipos-trabajo.service.js';
import type { ActualizarRequisito, CrearRequisito, ListarRequisitos } from './requisitos-tipo-trabajo.schemas.js';

// Se devuelve el nombre del documento o la capacitacion para no obligar al frontend a otra consulta
const incluir = {
  tipos_documento: { select: { id: true, codigo: true, nombre: true } },
  capacitaciones: { select: { id: true, codigo: true, nombre: true } },
} satisfies Prisma.requisitos_tipo_trabajoInclude;

export async function listar(filtros: ListarRequisitos) {
  const where: Prisma.requisitos_tipo_trabajoWhereInput = {};

  if (filtros.tipo_trabajo_id !== undefined) where.tipo_trabajo_id = filtros.tipo_trabajo_id;
  if (filtros.obligatorio !== undefined) where.obligatorio = filtros.obligatorio;
  if (filtros.tipo === 'documento') where.tipo_documento_id = { not: null };
  if (filtros.tipo === 'capacitacion') where.capacitacion_id = { not: null };

  const [total, datos] = await prisma.$transaction([
    prisma.requisitos_tipo_trabajo.count({ where }),
    prisma.requisitos_tipo_trabajo.findMany({
      where,
      include: incluir,
      orderBy: [{ tipo_trabajo_id: 'asc' }, { id: 'asc' }],
      ...paginar(filtros),
    }),
  ]);

  return { datos, total };
}

export async function obtener(id: number) {
  const requisito = await prisma.requisitos_tipo_trabajo.findUnique({ where: { id }, include: incluir });
  if (!requisito) throw new AppError(404, 'REQUISITO_NO_ENCONTRADO', `No existe el requisito ${id}`);
  return requisito;
}

export async function crear(datos: CrearRequisito) {
  // Cada obtener lanza 404 con un mensaje claro si el id no existe
  await tiposTrabajoService.obtener(datos.tipo_trabajo_id);
  if (datos.tipo_documento_id != null) await tiposDocumentoService.obtener(datos.tipo_documento_id);
  if (datos.capacitacion_id != null) await capacitacionesService.obtener(datos.capacitacion_id);

  return prisma.requisitos_tipo_trabajo.create({ data: datos, include: incluir });
}

export async function actualizar(id: number, datos: ActualizarRequisito) {
  await obtener(id);
  return prisma.requisitos_tipo_trabajo.update({ where: { id }, data: datos, include: incluir });
}

// Nadie referencia a un requisito: borrado real
export async function eliminar(id: number) {
  await obtener(id);
  return prisma.requisitos_tipo_trabajo.delete({ where: { id } });
}