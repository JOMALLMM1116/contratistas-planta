import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import type {
  ActualizarTipoDocumento,
  CrearTipoDocumento,
  ListarTiposDocumento,
} from './tipos-documento.schemas.js';

export async function listar(filtros: ListarTiposDocumento) {
  const where: Prisma.tipos_documentoWhereInput = {};

  if (filtros.buscar) {
    where.OR = [
      { codigo: { contains: filtros.buscar, mode: 'insensitive' } },
      { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
    ];
  }
  if (filtros.aplica_a) where.aplica_a = filtros.aplica_a;
  if (filtros.requiere_vencimiento !== undefined) where.requiere_vencimiento = filtros.requiere_vencimiento;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.tipos_documentoOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.tipos_documento.count({ where }),
    prisma.tipos_documento.findMany({ where, orderBy, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: number) {
  const tipo = await prisma.tipos_documento.findUnique({ where: { id } });
  if (!tipo) throw new AppError(404, 'TIPO_DOCUMENTO_NO_ENCONTRADO', `No existe el tipo de documento ${id}`);
  return tipo;
}

export async function crear(datos: CrearTipoDocumento) {
  return prisma.tipos_documento.create({ data: datos });
}

export async function actualizar(id: number, datos: ActualizarTipoDocumento) {
  await obtener(id);
  return prisma.tipos_documento.update({ where: { id }, data: datos });
}

// Sin campo "activo" en la tabla: borrado real. Si esta en uso, la FK responde 409
export async function eliminar(id: number) {
  await obtener(id);
  return prisma.tipos_documento.delete({ where: { id } });
}