import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import { fueraDeAlcance, type Alcance } from '../../shared/seguridad/alcance.js';
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

// Alcance por defecto para llamadas internas entre modulos (el controlador siempre pasa el de la sesion)
const INTERNO: Alcance = { tipo: 'interno' };

// Solo campos livianos de cada relacion (sin BigInt, que no se serializa a JSON)
const incluir = {
  contratistas: { select: { id: true, nombres: true, apellidos: true, documento_identidad: true } },
  capacitaciones: { select: { id: true, codigo: true, nombre: true, vigencia_meses: true } },
  archivos: { select: { id: true, nombre_original: true, mime_type: true } },
} satisfies Prisma.contratista_capacitacionesInclude;

// ---- Autorizacion por objeto (SEG-01) ----
function filtroAlcance(alcance: Alcance): Prisma.contratista_capacitacionesWhereInput {
  switch (alcance.tipo) {
    case 'interno':
      return {};
    case 'empresa':
      return { contratistas: { empresa_id: alcance.empresaId } };
    case 'contratista':
      return { contratista_id: alcance.contratistaId };
    default:
      return { id: { in: [] } };
  }
}

// Si el registro existe pero no esta en el alcance, responde igual que si no existiera
async function verificarAlcance(id: string, alcance: Alcance) {
  if (alcance.tipo === 'interno') return;
  const visible = await prisma.contratista_capacitaciones.count({ where: { AND: [{ id }, filtroAlcance(alcance)] } });
  if (visible === 0) throw fueraDeAlcance('REGISTRO_NO_ENCONTRADO', `No existe el registro de capacitacion ${id}`);
}

// Un usuario externo solo registra capacitaciones de contratistas de su alcance
async function verificarContratista(contratistaId: string, alcance: Alcance) {
  if (alcance.tipo === 'interno') return;
  const denegar = () => new AppError(403, 'SIN_PERMISO', 'Solo puede registrar capacitaciones propias o de su empresa');

  if (alcance.tipo === 'contratista') {
    if (contratistaId !== alcance.contratistaId) throw denegar();
    return;
  }
  if (alcance.tipo === 'empresa') {
    const contratista = await contratistasService.obtener(contratistaId);
    if (contratista.empresa_id !== alcance.empresaId) throw denegar();
    return;
  }
  throw denegar();
}

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

export async function listar(filtros: ListarRegistros, alcance: Alcance = INTERNO) {
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

  // Los filtros del usuario se combinan con su alcance (no lo pueden ampliar)
  const condicion: Prisma.contratista_capacitacionesWhereInput = { AND: [where, filtroAlcance(alcance)] };
  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.contratista_capacitacionesOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.contratista_capacitaciones.count({ where: condicion }),
    prisma.contratista_capacitaciones.findMany({ where: condicion, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: string, alcance: Alcance = INTERNO) {
  const registro = await prisma.contratista_capacitaciones.findFirst({
    where: { AND: [{ id }, filtroAlcance(alcance)] },
    include: incluir,
  });
  if (!registro) throw new AppError(404, 'REGISTRO_NO_ENCONTRADO', `No existe el registro de capacitacion ${id}`);
  return registro;
}

export async function crear(datos: CrearRegistro, alcance: Alcance = INTERNO, usuarioId: string | null = null) {
  await contratistasService.obtener(datos.contratista_id);
  await verificarContratista(datos.contratista_id, alcance);
  const capacitacion = await capacitacionesService.obtener(datos.capacitacion_id);
  // El archivo debe ser uno que el usuario puede ver
  if (datos.archivo_id) await archivosService.obtener(datos.archivo_id, alcance, usuarioId);

  // Si no se indica vencimiento, se calcula con la vigencia de la capacitacion
  const fecha_vencimiento =
    datos.fecha_vencimiento !== undefined
      ? datos.fecha_vencimiento
      : calcularVencimiento(datos.fecha_realizacion, capacitacion.vigencia_meses);

  return prisma.contratista_capacitaciones.create({ data: { ...datos, fecha_vencimiento }, include: incluir });
}

export async function actualizar(
  id: string,
  datos: ActualizarRegistro,
  alcance: Alcance = INTERNO,
  usuarioId: string | null = null,
) {
  const registro = await buscar(id);
  await verificarAlcance(id, alcance);
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

  if (data.archivo_id) await archivosService.obtener(data.archivo_id, alcance, usuarioId);

  return prisma.contratista_capacitaciones.update({ where: { id }, data, include: incluir });
}

// Aprobar o rechazar: actualiza el registro y deja constancia en el historial, en una transaccion
export async function revisar(id: string, datos: RevisarRegistro, alcance: Alcance = INTERNO) {
  const registro = await buscar(id);
  await verificarAlcance(id, alcance);
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
export async function eliminar(id: string, alcance: Alcance = INTERNO) {
  const registro = await buscar(id);
  await verificarAlcance(id, alcance);
  if (registro.estado_revision === 'aprobado') {
    throw new AppError(409, 'REGISTRO_APROBADO', 'Un registro de capacitacion aprobado no se puede eliminar');
  }
  return prisma.contratista_capacitaciones.delete({ where: { id }, include: incluir });
}
