import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as archivosService from '../archivos/archivos.service.js';
import * as solicitudesService from '../solicitudes/solicitudes.service.js';
import type {
  CerrarPermiso,
  CrearEvidencia,
  CrearPermiso,
  IniciarPermiso,
  ListarPermisos,
  RegistrarChecklist,
  RevocarPermiso,
} from './permisos-trabajo.schemas.js';

type Solicitud = Awaited<ReturnType<typeof solicitudesService.obtener>>;

const solicitudSelect = {
  id: true,
  codigo: true,
  descripcion_actividad: true,
  empresas_contratistas: { select: { id: true, nit: true, razon_social: true } },
  tipos_trabajo: { select: { id: true, codigo: true, nombre: true } },
} satisfies Prisma.solicitudes_accesoSelect;

// Sin BigInt (tamano_bytes), que no se serializa a JSON
const archivoSelect = { id: true, nombre_original: true, mime_type: true } satisfies Prisma.archivosSelect;

const incluirResumen = {
  solicitudes_acceso: { select: solicitudSelect },
  _count: { select: { evidencias_trabajo: true } },
} satisfies Prisma.permisos_trabajoInclude;

const incluirDetalle = {
  solicitudes_acceso: { select: solicitudSelect },
  evidencias_trabajo: { orderBy: { created_at: 'asc' }, include: { archivos: { select: archivoSelect } } },
} satisfies Prisma.permisos_trabajoInclude;

const incluirEvidencia = { archivos: { select: archivoSelect } } satisfies Prisma.evidencias_trabajoInclude;

// Las columnas TIME salen como fecha ISO; se devuelven como "HH:MM"
const hhmm = (d: Date) => d.toISOString().slice(11, 16);
const aHora = (v: string) => new Date(`1970-01-01T${v}:00.000Z`);

function formatear<T extends { hora_inicio: Date; hora_fin: Date }>(permiso: T) {
  return { ...permiso, hora_inicio: hhmm(permiso.hora_inicio), hora_fin: hhmm(permiso.hora_fin) };
}

async function buscar(id: string) {
  const permiso = await prisma.permisos_trabajo.findUnique({ where: { id } });
  if (!permiso) throw new AppError(404, 'PERMISO_NO_ENCONTRADO', `No existe el permiso de trabajo ${id}`);
  return permiso;
}

function exigirEstado(actual: string, permitidos: string[], mensaje: string) {
  if (!permitidos.includes(actual)) {
    throw new AppError(409, 'ESTADO_INVALIDO', `${mensaje} (estado actual: ${actual})`);
  }
}

// El trigger de la base escribe el historial leyendo app.user_id y app.motivo
// (set_config local: solo vale para esta transaccion)
async function cambiarEstado(
  tx: Prisma.TransactionClient,
  id: string,
  estado: string,
  usuarioId: string | null,
  motivo: string | null,
  extra: Prisma.permisos_trabajoUncheckedUpdateInput = {},
) {
  await tx.$queryRaw`SELECT set_config('app.user_id', ${usuarioId ?? ''}, true) AS usuario, set_config('app.motivo', ${motivo ?? ''}, true) AS motivo`;
  return tx.permisos_trabajo.update({ where: { id }, data: { estado, ...extra } });
}

// Vigencia segun la base: estado emitido o en ejecucion, y fecha y hora dentro de la ventana (hora de Guatemala)
async function esVigente(id: string) {
  const [fila] = await prisma.$queryRaw<{ vigente: boolean }[]>`SELECT fn_permiso_vigente(${id}::uuid) AS vigente`;
  return fila?.vigente === true;
}

async function estaBloqueado(contratistaId: string) {
  const [fila] = await prisma.$queryRaw<{ bloqueado: boolean }[]>`SELECT fn_contratista_bloqueado(${contratistaId}::uuid) AS bloqueado`;
  return fila?.bloqueado === true;
}

// ---- Checklist ----
// Items de las plantillas activas del tipo de trabajo
async function itemsDelTipo(tipoTrabajoId: number) {
  return prisma.checklist_items.findMany({
    where: { checklist_plantillas: { tipo_trabajo_id: tipoTrabajoId, activa: true } },
    orderBy: [{ plantilla_id: 'asc' }, { orden: 'asc' }],
    select: { id: true, orden: true, descripcion: true, obligatorio: true },
  });
}

// Estado del checklist por contratista: un item obligatorio pendiente es el que falta o no cumple
async function calcularChecklist(solicitud: Solicitud) {
  const items = await itemsDelTipo(solicitud.tipos_trabajo.id);
  const respuestas = await prisma.checklist_respuestas.findMany({ where: { solicitud_id: solicitud.id } });
  const porClave = new Map(respuestas.map((r) => [`${r.contratista_id}:${r.item_id}`, r]));

  const contratistas = solicitud.solicitud_contratistas.map(({ contratistas: c }) => {
    const detalle = items.map((item) => {
      const respuesta = porClave.get(`${c.id}:${item.id}`);
      return {
        item_id: item.id,
        orden: item.orden,
        descripcion: item.descripcion,
        obligatorio: item.obligatorio,
        cumple: respuesta ? respuesta.cumple : null,
        observacion: respuesta?.observacion ?? null,
      };
    });
    const pendientes = detalle.filter((d) => d.obligatorio && d.cumple !== true).length;
    return { contratista_id: c.id, nombre: `${c.nombres} ${c.apellidos}`, pendientes, items: detalle };
  });

  return {
    completo: contratistas.every((c) => c.pendientes === 0),
    total_items: items.length,
    contratistas,
  };
}

export async function obtenerChecklist(id: string) {
  const permiso = await buscar(id);
  return calcularChecklist(await solicitudesService.obtener(permiso.solicitud_id));
}

export async function registrarChecklist(id: string, datos: RegistrarChecklist) {
  const permiso = await buscar(id);
  exigirEstado(permiso.estado, ['emitido', 'en_ejecucion'], 'Solo se registra el checklist de un permiso emitido o en ejecucion');

  const solicitud = await solicitudesService.obtener(permiso.solicitud_id);
  const contratistasValidos = new Set(solicitud.solicitud_contratistas.map((s) => s.contratistas.id));
  const itemsValidos = new Set((await itemsDelTipo(solicitud.tipos_trabajo.id)).map((i) => i.id));

  for (const r of datos.respuestas) {
    if (!contratistasValidos.has(r.contratista_id)) {
      throw new AppError(400, 'CONTRATISTA_NO_EN_SOLICITUD', `El contratista ${r.contratista_id} no esta en la solicitud`);
    }
    if (!itemsValidos.has(r.item_id)) {
      throw new AppError(400, 'ITEM_NO_APLICA', `El item ${r.item_id} no pertenece al checklist de este tipo de trabajo`);
    }
  }

  // Cada respuesta se crea o se corrige (unica por solicitud, contratista e item)
  await prisma.$transaction(
    datos.respuestas.map((r) =>
      prisma.checklist_respuestas.upsert({
        where: {
          solicitud_id_contratista_id_item_id: {
            solicitud_id: permiso.solicitud_id,
            contratista_id: r.contratista_id,
            item_id: r.item_id,
          },
        },
        create: {
          solicitud_id: permiso.solicitud_id,
          contratista_id: r.contratista_id,
          item_id: r.item_id,
          cumple: r.cumple,
          observacion: r.observacion ?? null,
        },
        update: { cumple: r.cumple, observacion: r.observacion ?? null, respondido_en: new Date() },
      }),
    ),
  );

  return calcularChecklist(solicitud);
}

// ---- Permisos ----
export async function listar(filtros: ListarPermisos) {
  const where: Prisma.permisos_trabajoWhereInput = {};

  if (filtros.buscar) where.codigo = { contains: filtros.buscar, mode: 'insensitive' };
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.solicitud_id) where.solicitud_id = filtros.solicitud_id;
  if (filtros.empresa_id) where.solicitudes_acceso = { empresa_id: filtros.empresa_id };
  if (filtros.desde) where.fecha_fin = { gte: filtros.desde };
  if (filtros.hasta) where.fecha_inicio = { lte: filtros.hasta };

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.permisos_trabajoOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.permisos_trabajo.count({ where }),
    prisma.permisos_trabajo.findMany({ where, orderBy, include: incluirResumen, ...paginar(filtros) }),
  ]);

  return { datos: datos.map((p) => formatear(p)), total };
}

export async function obtener(id: string) {
  const permiso = await prisma.permisos_trabajo.findUnique({ where: { id }, include: incluirDetalle });
  if (!permiso) throw new AppError(404, 'PERMISO_NO_ENCONTRADO', `No existe el permiso de trabajo ${id}`);
  return { ...formatear(permiso), vigente: await esVigente(id) };
}

export async function crear(datos: CrearPermiso) {
  const solicitud = await solicitudesService.obtener(datos.solicitud_id);

  if (solicitud.estado !== 'aprobada') {
    throw new AppError(409, 'SOLICITUD_NO_APROBADA', `Solo se emite permiso de una solicitud aprobada (estado actual: ${solicitud.estado})`);
  }
  if (!solicitud.tipos_trabajo.requiere_permiso_trabajo) {
    throw new AppError(409, 'TIPO_SIN_PERMISO', `El tipo de trabajo ${solicitud.tipos_trabajo.codigo} no requiere permiso de trabajo`);
  }

  const existente = await prisma.permisos_trabajo.findUnique({ where: { solicitud_id: solicitud.id }, select: { codigo: true } });
  if (existente) {
    throw new AppError(409, 'PERMISO_YA_EMITIDO', `La solicitud ya tiene el permiso ${existente.codigo}`);
  }

  const creado = await prisma.permisos_trabajo.create({
    data: {
      solicitud_id: solicitud.id,
      fecha_inicio: solicitud.fecha_inicio,
      fecha_fin: solicitud.fecha_fin,
      hora_inicio: aHora(solicitud.hora_inicio),
      hora_fin: aHora(solicitud.hora_fin),
      condiciones_especiales: datos.condiciones_especiales ?? null,
      aprobado_por: datos.aprobado_por,
    },
  });

  return obtener(creado.id);
}

export async function iniciar(id: string, datos: IniciarPermiso) {
  const permiso = await buscar(id);
  exigirEstado(permiso.estado, ['emitido'], 'Solo se inicia un permiso emitido');

  if (!(await esVigente(id))) {
    throw new AppError(409, 'PERMISO_NO_VIGENTE', 'El permiso esta fuera de su fecha u horario de vigencia');
  }

  const solicitud = await solicitudesService.obtener(permiso.solicitud_id);

  const bloqueados: { contratista_id: string; nombre: string }[] = [];
  for (const { contratistas: c } of solicitud.solicitud_contratistas) {
    if (await estaBloqueado(c.id)) bloqueados.push({ contratista_id: c.id, nombre: `${c.nombres} ${c.apellidos}` });
  }
  if (bloqueados.length > 0) {
    throw new AppError(409, 'CONTRATISTAS_BLOQUEADOS', 'Hay contratistas bloqueados en el permiso', bloqueados);
  }

  const checklist = await calcularChecklist(solicitud);
  if (!checklist.completo) {
    const pendientes = checklist.contratistas
      .filter((c) => c.pendientes > 0)
      .map((c) => ({ contratista_id: c.contratista_id, nombre: c.nombre, pendientes: c.pendientes }));
    throw new AppError(409, 'CHECKLIST_INCOMPLETO', 'Hay items obligatorios del checklist sin cumplir', pendientes);
  }

  await prisma.$transaction((tx) =>
    cambiarEstado(tx, id, 'en_ejecucion', datos.usuario_id, null, {
      actividad_inicio_en: new Date(),
      actividad_inicio_por: datos.usuario_id,
    }),
  );
  return obtener(id);
}

export async function cerrar(id: string, datos: CerrarPermiso) {
  const permiso = await buscar(id);
  exigirEstado(permiso.estado, ['en_ejecucion'], 'Solo se cierra un permiso en ejecucion');

  await prisma.$transaction((tx) =>
    cambiarEstado(tx, id, 'cerrado', datos.usuario_id, datos.observaciones ?? null, {
      actividad_fin_en: new Date(),
      actividad_fin_por: datos.usuario_id,
    }),
  );
  return obtener(id);
}

export async function revocar(id: string, datos: RevocarPermiso) {
  const permiso = await buscar(id);
  exigirEstado(permiso.estado, ['emitido', 'en_ejecucion'], 'Solo se revoca un permiso emitido o en ejecucion');

  await prisma.$transaction((tx) =>
    cambiarEstado(tx, id, 'revocado', datos.usuario_id, datos.motivo, {
      revocado_por: datos.usuario_id,
      revocado_en: new Date(),
      motivo_revocacion: datos.motivo,
    }),
  );
  return obtener(id);
}

// ---- Evidencias ----
export async function listarEvidencias(id: string) {
  await buscar(id);
  return prisma.evidencias_trabajo.findMany({
    where: { permiso_trabajo_id: id },
    orderBy: { created_at: 'asc' },
    include: incluirEvidencia,
  });
}

export async function agregarEvidencia(id: string, datos: CrearEvidencia) {
  const permiso = await buscar(id);
  exigirEstado(permiso.estado, ['emitido', 'en_ejecucion', 'cerrado'], 'No se agregan evidencias a un permiso revocado o vencido');
  await archivosService.obtener(datos.archivo_id);

  return prisma.evidencias_trabajo.create({
    data: {
      permiso_trabajo_id: id,
      archivo_id: datos.archivo_id,
      momento: datos.momento,
      descripcion: datos.descripcion ?? null,
      registrado_por: datos.registrado_por,
    },
    include: incluirEvidencia,
  });
}

// Se quita el vinculo; el archivo sigue en el modulo de archivos
export async function eliminarEvidencia(id: string, evidenciaId: string) {
  const permiso = await buscar(id);
  exigirEstado(permiso.estado, ['emitido', 'en_ejecucion'], 'Las evidencias de un permiso cerrado, revocado o vencido no se eliminan');

  const evidencia = await prisma.evidencias_trabajo.findFirst({ where: { id: evidenciaId, permiso_trabajo_id: id } });
  if (!evidencia) throw new AppError(404, 'EVIDENCIA_NO_ENCONTRADA', `El permiso no tiene la evidencia ${evidenciaId}`);

  return prisma.evidencias_trabajo.delete({ where: { id: evidenciaId }, include: incluirEvidencia });
}