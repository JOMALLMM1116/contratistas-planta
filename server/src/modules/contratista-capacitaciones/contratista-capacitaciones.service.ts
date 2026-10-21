import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as archivosService from '../archivos/archivos.service.js';
import * as capacitacionesService from '../capacitaciones/capacitaciones.service.js';
import * as contratistasService from '../contratistas/contratistas.service.js';
import type {
  ActualizarRegistro,
  CrearRegistro,
  ListarRegistros,
  RevisarRegistro,
} from './contratista-capacitaciones.schemas.js';

// Valor de la columna historial_estados.entidad para este modulo
const ENTIDAD_HISTORIAL = 'contratista_capacitacion';

// Solo campos livianos de cada relacion (sin BigInt, que no se serializa a JSON)
const incluir = {
  contratistas: { select: { id: true, nombres: true, apellidos: true, documento_identidad: true } },
  capacitaciones: { select: { id: true, codigo: true, nombre: true, vigencia_meses: true } },
  archivos: { select: { id: true, nombre_original: true, mime_type: true } },
} satisfies Prisma.contratista_capacitacionesInclude;

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

// Suma meses sin desbordar (31 de enero + 1 mes = 28 o 29 de febrero)
function sumarMeses(fecha: Date, meses: number) {
  const dia = fecha.getUTCDate();
  const resultado = new Date(fecha);
  resultado.setUTCDate(1);
  resultado.setUTCMonth(resultado.getUTCMonth() + meses);
  const ultimoDia = new Date(Date.UTC(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0)).getUTCDate();
  resultado.setUTCDate(Math.min(dia, ultimoDia));
  return resultado;
}

function calcularVencimiento(realizacion: Date, vigenciaMeses: number | null) {
  return vigenciaMeses == null ? null : sumarMeses(realizacion, vigenciaMeses);
}

async function buscar(id: string) {
  const registro = await prisma.contratista_capacitaciones.findUnique({ where: { id } });
  if (!registro) throw new AppError(404, 'REGISTRO_NO_ENCONTRADO', `No existe el registro de capacitacion ${id}`);
  return registro;
}

function exigirPendiente(estado: string) {
  if (estado !== 'pendiente') {
    throw new AppError(409, 'REGISTRO_YA_REVISADO', 'El registro de capacitacion ya fue revisado');
  }
}

export async function listar(filtros: ListarRegistros) {
  const where: Prisma.contratista_capacitacionesWhereInput = {};

  if (filtros.contratista_id) where.contratista_id = filtros.contratista_id;
  if (filtros.capacitacion_id !== undefined) where.capacitacion_id = filtros.capacitacion_id;
  if (filtros.estado_revision) where.estado_revision = filtros.estado_revision;

  const rango: { lt?: Date; gte?: Date; lte?: Date } = {};
  const hoy = hoyGuatemala();
  if (filtros.vencidos) rango.lt = hoy;
  if (filtros.por_vencer !== undefined) {
    rango.gte = hoy;
    rango.lte = sumarDias(hoy, filtros.por_vencer);
  }
  if (Object.keys(rango).length > 0) where.fecha_vencimiento = rango;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.contratista_capacitacionesOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.contratista_capacitaciones.count({ where }),
    prisma.contratista_capacitaciones.findMany({ where, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: string) {
  const registro = await prisma.contratista_capacitaciones.findUnique({ where: { id }, include: incluir });
  if (!registro) throw new AppError(404, 'REGISTRO_NO_ENCONTRADO', `No existe el registro de capacitacion ${id}`);
  return registro;
}

export async function crear(datos: CrearRegistro) {
  await contratistasService.obtener(datos.contratista_id);
  const capacitacion = await capacitacionesService.obtener(datos.capacitacion_id);
  if (datos.archivo_id) await archivosService.obtener(datos.archivo_id);

  // Si no se indica vencimiento, se calcula con la vigencia de la capacitacion
  const fecha_vencimiento =
    datos.fecha_vencimiento !== undefined
      ? datos.fecha_vencimiento
      : calcularVencimiento(datos.fecha_realizacion, capacitacion.vigencia_meses);

  return prisma.contratista_capacitaciones.create({ data: { ...datos, fecha_vencimiento }, include: incluir });
}

export async function actualizar(id: string, datos: ActualizarRegistro) {
  const registro = await buscar(id);
  exigirPendiente(registro.estado_revision);

  const data = { ...datos };

  // Si cambia la realizacion y no se indica vencimiento, se recalcula
  if (datos.fecha_realizacion && datos.fecha_vencimiento === undefined) {
    const capacitacion = await capacitacionesService.obtener(registro.capacitacion_id);
    data.fecha_vencimiento = calcularVencimiento(datos.fecha_realizacion, capacitacion.vigencia_meses);
  }

  const realizacion = data.fecha_realizacion ?? registro.fecha_realizacion;
  const vencimiento = data.fecha_vencimiento !== undefined ? data.fecha_vencimiento : registro.fecha_vencimiento;
  if (vencimiento && vencimiento < realizacion) {
    throw new AppError(400, 'FECHAS_INVALIDAS', 'La fecha de vencimiento no puede ser anterior a la de realizacion');
  }

  if (data.archivo_id) await archivosService.obtener(data.archivo_id);

  return prisma.contratista_capacitaciones.update({ where: { id }, data, include: incluir });
}

// Aprobar o rechazar: actualiza el registro y deja constancia en el historial, en una transaccion
export async function revisar(id: string, datos: RevisarRegistro) {
  const registro = await buscar(id);
  exigirPendiente(registro.estado_revision);

  const [actualizado] = await prisma.$transaction([
    prisma.contratista_capacitaciones.update({
      where: { id },
      data: { estado_revision: datos.decision, revisado_por: datos.revisado_por, revisado_en: new Date() },
      include: incluir,
    }),
    prisma.historial_estados.create({
      data: {
        entidad: ENTIDAD_HISTORIAL,
        entidad_id: id,
        estado_anterior: 'pendiente',
        estado_nuevo: datos.decision,
        motivo: datos.motivo ?? null,
        usuario_id: datos.revisado_por,
      },
    }),
  ]);

  return actualizado;
}

// Un registro aprobado respalda accesos y permisos: no se borra
export async function eliminar(id: string) {
  const registro = await buscar(id);
  if (registro.estado_revision === 'aprobado') {
    throw new AppError(409, 'REGISTRO_APROBADO', 'Un registro de capacitacion aprobado no se puede eliminar');
  }
  return prisma.contratista_capacitaciones.delete({ where: { id }, include: incluir });
}