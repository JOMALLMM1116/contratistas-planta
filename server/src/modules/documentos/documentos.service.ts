import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as archivosService from '../archivos/archivos.service.js';
import * as contratistasService from '../contratistas/contratistas.service.js';
import * as empresasService from '../empresas-contratistas/empresas-contratistas.service.js';
import * as equiposService from '../equipos/equipos.service.js';
import * as tiposDocumentoService from '../tipos-documento/tipos-documento.service.js';
import type {
  ActualizarDocumento,
  CrearDocumento,
  ListarDocumentos,
  RevisarDocumento,
} from './documentos.schemas.js';

// Valor de la columna historial_estados.entidad para este modulo
const ENTIDAD_HISTORIAL = 'documento';

// Solo campos livianos de cada relacion (sin BigInt, que no se serializa a JSON)
const incluir = {
  tipos_documento: { select: { id: true, codigo: true, nombre: true, aplica_a: true } },
  archivos: { select: { id: true, nombre_original: true, mime_type: true } },
  contratistas: { select: { id: true, nombres: true, apellidos: true, documento_identidad: true } },
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
  equipos: { select: { id: true, codigo: true, nombre: true } },
} satisfies Prisma.documentosInclude;

// Fecha de hoy en Guatemala, como medianoche UTC (las columnas son DATE)
function hoyGuatemala() {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
  return new Date(iso);
}

function sumarDias(fecha: Date, dias: number) {
  const resultado = new Date(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

async function buscar(id: string) {
  const documento = await prisma.documentos.findUnique({ where: { id } });
  if (!documento) throw new AppError(404, 'DOCUMENTO_NO_ENCONTRADO', `No existe el documento ${id}`);
  return documento;
}

function exigirPendiente(estado: string) {
  if (estado !== 'pendiente') {
    throw new AppError(409, 'DOCUMENTO_YA_REVISADO', 'El documento ya fue revisado');
  }
}

export async function listar(filtros: ListarDocumentos) {
  const where: Prisma.documentosWhereInput = {};

  if (filtros.buscar) where.numero = { contains: filtros.buscar, mode: 'insensitive' };
  if (filtros.contratista_id) where.contratista_id = filtros.contratista_id;
  if (filtros.empresa_id) where.empresa_id = filtros.empresa_id;
  if (filtros.equipo_id) where.equipo_id = filtros.equipo_id;
  if (filtros.tipo_documento_id !== undefined) where.tipo_documento_id = filtros.tipo_documento_id;
  if (filtros.estado_revision) where.estado_revision = filtros.estado_revision;

  const rango: { lt?: Date; gte?: Date; lte?: Date } = {};
  const hoy = hoyGuatemala();
  if (filtros.vencidos) rango.lt = hoy;
  if (filtros.por_vencer !== undefined) {
    rango.gte = hoy;
    rango.lte = sumarDias(hoy, filtros.por_vencer);
  }
  if (Object.keys(rango).length > 0) where.fecha_vencimiento = rango;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.documentosOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.documentos.count({ where }),
    prisma.documentos.findMany({ where, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: string) {
  const documento = await prisma.documentos.findUnique({ where: { id }, include: incluir });
  if (!documento) throw new AppError(404, 'DOCUMENTO_NO_ENCONTRADO', `No existe el documento ${id}`);
  return documento;
}

export async function crear(datos: CrearDocumento) {
  const tipo = await tiposDocumentoService.obtener(datos.tipo_documento_id);

  // El tipo de documento debe corresponder al dueno (contratista, empresa o equipo)
  const dueno = datos.contratista_id ? 'contratista' : datos.empresa_id ? 'empresa' : 'equipo';
  if (tipo.aplica_a !== dueno) {
    throw new AppError(400, 'TIPO_NO_APLICA', `El tipo ${tipo.codigo} aplica a ${tipo.aplica_a}, no a ${dueno}`);
  }
  if (tipo.requiere_vencimiento && !datos.fecha_vencimiento) {
    throw new AppError(400, 'FECHA_VENCIMIENTO_REQUERIDA', `El tipo ${tipo.codigo} exige fecha de vencimiento`);
  }

  if (datos.contratista_id) await contratistasService.obtener(datos.contratista_id);
  if (datos.empresa_id) await empresasService.obtener(datos.empresa_id);
  if (datos.equipo_id) await equiposService.obtener(datos.equipo_id);
  await archivosService.obtener(datos.archivo_id);

  return prisma.documentos.create({ data: datos, include: incluir });
}

export async function actualizar(id: string, datos: ActualizarDocumento) {
  const documento = await buscar(id);
  exigirPendiente(documento.estado_revision);

  const emision = datos.fecha_emision !== undefined ? datos.fecha_emision : documento.fecha_emision;
  const vencimiento = datos.fecha_vencimiento !== undefined ? datos.fecha_vencimiento : documento.fecha_vencimiento;

  if (emision && vencimiento && vencimiento < emision) {
    throw new AppError(400, 'FECHAS_INVALIDAS', 'La fecha de vencimiento no puede ser anterior a la de emision');
  }
  if (!vencimiento) {
    const tipo = await tiposDocumentoService.obtener(documento.tipo_documento_id);
    if (tipo.requiere_vencimiento) {
      throw new AppError(400, 'FECHA_VENCIMIENTO_REQUERIDA', `El tipo ${tipo.codigo} exige fecha de vencimiento`);
    }
  }

  return prisma.documentos.update({ where: { id }, data: datos, include: incluir });
}

// Aprobar o rechazar: actualiza el documento y deja registro en el historial, en una transaccion
export async function revisar(id: string, datos: RevisarDocumento) {
  const documento = await buscar(id);
  exigirPendiente(documento.estado_revision);

  const [actualizado] = await prisma.$transaction([
    prisma.documentos.update({
      where: { id },
      data: {
        estado_revision: datos.decision,
        revisado_por: datos.revisado_por,
        revisado_en: new Date(),
        observaciones: datos.observaciones ?? documento.observaciones,
      },
      include: incluir,
    }),
    prisma.historial_estados.create({
      data: {
        entidad: ENTIDAD_HISTORIAL,
        entidad_id: id,
        estado_anterior: 'pendiente',
        estado_nuevo: datos.decision,
        motivo: datos.observaciones ?? null,
        usuario_id: datos.revisado_por,
      },
    }),
  ]);

  return actualizado;
}

// Un documento aprobado respalda accesos y permisos: no se borra
export async function eliminar(id: string) {
  const documento = await buscar(id);
  if (documento.estado_revision === 'aprobado') {
    throw new AppError(409, 'DOCUMENTO_APROBADO', 'Un documento aprobado no se puede eliminar');
  }
  return prisma.documentos.delete({ where: { id }, include: incluir });
}