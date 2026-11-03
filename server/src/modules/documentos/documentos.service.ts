import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import { fueraDeAlcance, type Alcance } from '../../shared/seguridad/alcance.js';
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

// Alcance por defecto para llamadas internas entre modulos (el controlador siempre pasa el de la sesion)
const INTERNO: Alcance = { tipo: 'interno' };

// Solo campos livianos de cada relacion (sin BigInt, que no se serializa a JSON)
const incluir = {
  tipos_documento: { select: { id: true, codigo: true, nombre: true, aplica_a: true } },
  archivos: { select: { id: true, nombre_original: true, mime_type: true } },
  contratistas: { select: { id: true, nombres: true, apellidos: true, documento_identidad: true } },
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
  equipos: { select: { id: true, codigo: true, nombre: true } },
} satisfies Prisma.documentosInclude;

// ---- Autorizacion por objeto (SEG-01) ----

// Documentos que puede ver o gestionar el usuario
function filtroAlcance(alcance: Alcance): Prisma.documentosWhereInput {
  switch (alcance.tipo) {
    case 'interno':
      return {};
    case 'contratista':
      return { contratista_id: alcance.contratistaId };
    case 'empresa': {
      const e = alcance.empresaId;
      return { OR: [{ empresa_id: e }, { contratistas: { empresa_id: e } }, { equipos: { empresa_id: e } }] };
    }
    default:
      // Falla cerrado: ningun documento
      return { id: { in: [] } };
  }
}

// Si el documento existe pero no esta en el alcance, responde igual que si no existiera
async function verificarAlcance(id: string, alcance: Alcance) {
  if (alcance.tipo === 'interno') return;
  const visible = await prisma.documentos.count({ where: { AND: [{ id }, filtroAlcance(alcance)] } });
  if (visible === 0) throw fueraDeAlcance('DOCUMENTO_NO_ENCONTRADO', `No existe el documento ${id}`);
}

// Un usuario externo solo registra documentos cuyo dueno este en su alcance
async function verificarDueno(datos: CrearDocumento, alcance: Alcance) {
  if (alcance.tipo === 'interno') return;

  const denegar = () => new AppError(403, 'SIN_PERMISO', 'Solo puede registrar documentos propios o de su empresa');

  if (alcance.tipo === 'contratista') {
    if (datos.contratista_id !== alcance.contratistaId) throw denegar();
    return;
  }
  if (alcance.tipo === 'empresa') {
    if (datos.empresa_id && datos.empresa_id !== alcance.empresaId) throw denegar();
    if (datos.contratista_id) {
      const contratista = await contratistasService.obtener(datos.contratista_id);
      if (contratista.empresa_id !== alcance.empresaId) throw denegar();
    }
    if (datos.equipo_id) {
      const equipo = await equiposService.obtener(datos.equipo_id);
      if (equipo.empresa_id !== alcance.empresaId) throw denegar();
    }
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

export async function listar(filtros: ListarDocumentos, alcance: Alcance = INTERNO) {
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

  // Los filtros del usuario se combinan con su alcance (no lo pueden ampliar)
  const condicion: Prisma.documentosWhereInput = { AND: [where, filtroAlcance(alcance)] };
  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.documentosOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.documentos.count({ where: condicion }),
    prisma.documentos.findMany({ where: condicion, orderBy, include: incluir, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function obtener(id: string, alcance: Alcance = INTERNO) {
  const documento = await prisma.documentos.findFirst({
    where: { AND: [{ id }, filtroAlcance(alcance)] },
    include: incluir,
  });
  if (!documento) throw new AppError(404, 'DOCUMENTO_NO_ENCONTRADO', `No existe el documento ${id}`);
  return documento;
}

export async function crear(datos: CrearDocumento, alcance: Alcance = INTERNO, usuarioId: string | null = null) {
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

  // El dueno debe estar en el alcance del usuario
  await verificarDueno(datos, alcance);
  // El archivo debe ser uno que el usuario puede ver (no se puede "adoptar" el archivo de otra persona)
  await archivosService.obtener(datos.archivo_id, alcance, usuarioId);

  // Quien sube el documento sale de la sesion
  return prisma.documentos.create({ data: { ...datos, subido_por: usuarioId }, include: incluir });
}

export async function actualizar(id: string, datos: ActualizarDocumento, alcance: Alcance = INTERNO) {
  const documento = await buscar(id);
  await verificarAlcance(id, alcance);
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
export async function revisar(id: string, datos: RevisarDocumento, alcance: Alcance = INTERNO) {
  const documento = await buscar(id);
  await verificarAlcance(id, alcance);
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
export async function eliminar(id: string, alcance: Alcance = INTERNO) {
  const documento = await buscar(id);
  await verificarAlcance(id, alcance);
  if (documento.estado_revision === 'aprobado') {
    throw new AppError(409, 'DOCUMENTO_APROBADO', 'Un documento aprobado no se puede eliminar');
  }
  return prisma.documentos.delete({ where: { id }, include: incluir });
}
