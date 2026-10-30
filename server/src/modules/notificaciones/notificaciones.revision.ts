import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { crearSinDuplicar, type NuevaNotificacion } from './notificaciones.service.js';

// ---- Reglas ajustables ----
const DIAS_ALERTA_CAPACITACION = 30; // la tabla de capacitaciones no define dias de alerta
const DIAS_VENCIDOS_ATRAS = 30; // solo se avisan vencimientos recientes
const MARCAR_PERMISOS_VENCIDOS = true; // false = solo notificar, sin cambiar estados

let enCurso = false;

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

const fechaISO = (d: Date) => d.toISOString().slice(0, 10);
const diasEntre = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

async function usuariosSeguridad() {
  const usuarios = await prisma.usuarios.findMany({
    where: { activo: true, roles: { codigo: 'seguridad_industrial' } },
    select: { id: true },
  });
  return usuarios.map((u) => u.id);
}

async function usuariosPorEmpresa(empresaIds: string[]) {
  const mapa = new Map<string, string[]>();
  if (empresaIds.length === 0) return mapa;

  const usuarios = await prisma.usuarios.findMany({
    where: { activo: true, empresa_id: { in: empresaIds } },
    select: { id: true, empresa_id: true },
  });
  for (const u of usuarios) {
    if (!u.empresa_id) continue;
    mapa.set(u.empresa_id, [...(mapa.get(u.empresa_id) ?? []), u.id]);
  }
  return mapa;
}

function textoVencimiento(vence: Date, hoy: Date) {
  const dias = diasEntre(vence, hoy);
  if (dias < 0) return `vencio el ${fechaISO(vence)}`;
  if (dias === 0) return 'vence hoy';
  return `vence el ${fechaISO(vence)} (en ${dias} dias)`;
}

async function revisarDocumentos(hoy: Date, seguridad: string[]) {
  const documentos = await prisma.documentos.findMany({
    where: {
      estado_revision: 'aprobado',
      fecha_vencimiento: { gte: sumarDias(hoy, -DIAS_VENCIDOS_ATRAS), lte: sumarDias(hoy, 365) },
    },
    include: {
      tipos_documento: { select: { nombre: true, dias_alerta_vencimiento: true } },
      contratistas: { select: { usuario_id: true, nombres: true, apellidos: true } },
      empresas_contratistas: { select: { id: true, razon_social: true } },
      equipos: { select: { empresa_id: true, codigo: true } },
    },
  });

  const empresaIds = documentos.flatMap((d) => [d.empresa_id, d.equipos?.empresa_id].filter((x): x is string => !!x));
  const usuariosEmpresa = await usuariosPorEmpresa([...new Set(empresaIds)]);

  const items: NuevaNotificacion[] = [];
  for (const d of documentos) {
    if (!d.fecha_vencimiento) continue;
    const vencido = d.fecha_vencimiento < hoy;
    const porVencer = !vencido && d.fecha_vencimiento <= sumarDias(hoy, d.tipos_documento.dias_alerta_vencimiento);
    if (!vencido && !porVencer) continue;

    const dueno = d.contratistas
      ? `${d.contratistas.nombres} ${d.contratistas.apellidos}`
      : d.empresas_contratistas
        ? d.empresas_contratistas.razon_social
        : `equipo ${d.equipos?.codigo ?? ''}`.trim();

    const destinatarios = new Set<string>(seguridad);
    if (d.contratistas?.usuario_id) destinatarios.add(d.contratistas.usuario_id);
    for (const id of usuariosEmpresa.get(d.empresa_id ?? d.equipos?.empresa_id ?? '') ?? []) destinatarios.add(id);

    for (const usuario_id of destinatarios) {
      items.push({
        usuario_id,
        tipo: vencido ? 'documento_vencido' : 'documento_por_vencer',
        titulo: `${vencido ? 'Documento vencido' : 'Documento por vencer'}: ${d.tipos_documento.nombre} (${dueno})`,
        mensaje: `El documento ${d.tipos_documento.nombre} de ${dueno} ${textoVencimiento(d.fecha_vencimiento, hoy)}.`,
        entidad: 'documento',
        entidad_id: d.id,
      });
    }
  }
  return crearSinDuplicar(items);
}

async function revisarCapacitaciones(hoy: Date, seguridad: string[]) {
  const registros = await prisma.contratista_capacitaciones.findMany({
    where: {
      estado_revision: 'aprobado',
      fecha_vencimiento: { gte: sumarDias(hoy, -DIAS_VENCIDOS_ATRAS), lte: sumarDias(hoy, DIAS_ALERTA_CAPACITACION) },
    },
    include: {
      capacitaciones: { select: { nombre: true } },
      contratistas: { select: { usuario_id: true, nombres: true, apellidos: true } },
    },
  });

  const items: NuevaNotificacion[] = [];
  for (const r of registros) {
    if (!r.fecha_vencimiento) continue;
    const vencida = r.fecha_vencimiento < hoy;
    const persona = `${r.contratistas.nombres} ${r.contratistas.apellidos}`;

    const destinatarios = new Set<string>(seguridad);
    if (r.contratistas.usuario_id) destinatarios.add(r.contratistas.usuario_id);

    for (const usuario_id of destinatarios) {
      items.push({
        usuario_id,
        tipo: vencida ? 'capacitacion_vencida' : 'capacitacion_por_vencer',
        titulo: `${vencida ? 'Capacitacion vencida' : 'Capacitacion por vencer'}: ${r.capacitaciones.nombre} (${persona})`,
        mensaje: `La capacitacion ${r.capacitaciones.nombre} de ${persona} ${textoVencimiento(r.fecha_vencimiento, hoy)}.`,
        entidad: 'contratista_capacitacion',
        entidad_id: r.id,
      });
    }
  }
  return crearSinDuplicar(items);
}

// Un permiso emitido que nunca se uso y cuya fecha ya paso se marca como vencido
async function revisarPermisos(hoy: Date, seguridad: string[]) {
  if (!MARCAR_PERMISOS_VENCIDOS) return { vencidos: 0, notificaciones: 0 };

  const permisos = await prisma.permisos_trabajo.findMany({
    where: { estado: 'emitido', fecha_fin: { lt: hoy } },
    include: { solicitudes_acceso: { select: { codigo: true, solicitada_por: true, responsable_interno_id: true } } },
  });

  const items: NuevaNotificacion[] = [];
  let vencidos = 0;

  for (const p of permisos) {
    // El trigger de la base escribe el historial leyendo app.user_id y app.motivo
    const { count } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.user_id', '', true) AS usuario, set_config('app.motivo', 'Vencimiento automatico', true) AS motivo`;
      return tx.permisos_trabajo.updateMany({ where: { id: p.id, estado: 'emitido' }, data: { estado: 'vencido' } });
    });
    if (count === 0) continue;
    vencidos += 1;

    const destinatarios = new Set<string>([...seguridad, p.solicitudes_acceso.solicitada_por, p.solicitudes_acceso.responsable_interno_id]);
    for (const usuario_id of destinatarios) {
      items.push({
        usuario_id,
        tipo: 'permiso_vencido',
        titulo: `Permiso vencido: ${p.codigo}`,
        mensaje: `El permiso ${p.codigo} (solicitud ${p.solicitudes_acceso.codigo}) vencio el ${fechaISO(p.fecha_fin)} sin iniciar actividad.`,
        entidad: 'permiso_trabajo',
        entidad_id: p.id,
      });
    }
  }

  return { vencidos, notificaciones: await crearSinDuplicar(items) };
}

export async function ejecutarRevision() {
  if (enCurso) throw new AppError(409, 'REVISION_EN_CURSO', 'Ya hay una revision en ejecucion');
  enCurso = true;

  try {
    const hoy = hoyGuatemala();
    const seguridad = await usuariosSeguridad();

    const documentos = await revisarDocumentos(hoy, seguridad);
    const capacitaciones = await revisarCapacitaciones(hoy, seguridad);
    const permisos = await revisarPermisos(hoy, seguridad);

    return {
      fecha: fechaISO(hoy),
      documentos,
      capacitaciones,
      permisos_vencidos: permisos.vencidos,
      notificaciones_permisos: permisos.notificaciones,
    };
  } finally {
    enCurso = false;
  }
}