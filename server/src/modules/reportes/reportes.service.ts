import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import * as empresasService from '../empresas-contratistas/empresas-contratistas.service.js';
import type { FiltrosReporte, TipoReporte } from './reportes.schemas.js';
import type { Fila, Reporte } from './reportes.tipos.js';

// ---- Reglas ajustables ----
const LIMITE_FILAS = 5000; // maximo de filas por reporte exportado
const DIAS_VENCIDOS_ATRAS = 30; // los vencimientos recientes que se siguen mostrando

const ESTADOS_SOLICITUD = ['borrador', 'pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada', 'vencida', 'revocada'] as const;
const ESTADOS_PERMISO = ['emitido', 'en_ejecucion', 'cerrado', 'revocado', 'vencido'] as const;
const ESTADOS_CONTRATISTA = ['activo', 'inactivo'] as const;

// ---- Fechas (hora de Guatemala) ----
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
const hhmm = (d: Date) => d.toISOString().slice(11, 16);
const diasEntre = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

function fechaHora(d: Date | null) {
  if (!d) return null;
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day} ${partes.hour}:${partes.minute}`;
}

// ---- Utilidades ----
function validarEstado(estado: string | undefined, validos: readonly string[]) {
  if (estado && !validos.includes(estado)) {
    throw new AppError(400, 'FILTRO_ESTADO_INVALIDO', `Estado invalido. Valores permitidos: ${validos.join(', ')}`);
  }
}

async function lineasFiltros(f: FiltrosReporte, usa: { estado?: boolean; fechas?: boolean }) {
  const lineas = [`Generado: ${fechaHora(new Date())}`];
  if (f.empresa_id) {
    const empresa = await empresasService.obtener(f.empresa_id);
    lineas.push(`Empresa: ${empresa.nit} - ${empresa.razon_social}`);
  }
  if (usa.estado && f.estado) lineas.push(`Estado: ${f.estado}`);
  if (usa.fechas && f.desde) lineas.push(`Desde: ${fechaISO(f.desde)}`);
  if (usa.fechas && f.hasta) lineas.push(`Hasta: ${fechaISO(f.hasta)}`);
  return lineas;
}

function avisoLimite(lineas: string[], filas: number) {
  if (filas >= LIMITE_FILAS) lineas.push(`Se muestran las primeras ${LIMITE_FILAS} filas; use filtros para acotar el reporte`);
  return lineas;
}

function porEstado(filas: { estado: string; _count: { _all: number } }[], estados: readonly string[]) {
  const mapa = new Map(filas.map((f) => [f.estado, f._count._all]));
  return Object.fromEntries(estados.map((e) => [e, mapa.get(e) ?? 0]));
}

const sumar = (filas: { _count: { _all: number } }[]) => filas.reduce((total, f) => total + f._count._all, 0);

// ---- Dashboard ----
export async function dashboard(dias: number) {
  const hoy = hoyGuatemala();
  const porVencer = { gte: hoy, lte: sumarDias(hoy, dias) };
  const vencidos = { gte: sumarDias(hoy, -DIAS_VENCIDOS_ATRAS), lt: hoy };
  const aprobado = { estado_revision: 'aprobado' };

  const [
    solicitudes,
    permisos,
    permisosVigentes,
    docsPorVencer,
    docsVencidos,
    capsPorVencer,
    capsVencidas,
    empresasActivas,
    contratistasActivos,
    equiposActivos,
    empresasTop,
  ] = await Promise.all([
    prisma.solicitudes_acceso.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.permisos_trabajo.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.permisos_trabajo.count({
      where: { estado: { in: ['emitido', 'en_ejecucion'] }, fecha_inicio: { lte: hoy }, fecha_fin: { gte: hoy } },
    }),
    prisma.documentos.count({ where: { ...aprobado, fecha_vencimiento: porVencer } }),
    prisma.documentos.count({ where: { ...aprobado, fecha_vencimiento: vencidos } }),
    prisma.contratista_capacitaciones.count({ where: { ...aprobado, fecha_vencimiento: porVencer } }),
    prisma.contratista_capacitaciones.count({ where: { ...aprobado, fecha_vencimiento: vencidos } }),
    prisma.empresas_contratistas.count({ where: { estado: 'activa' } }),
    prisma.contratistas.count({ where: { estado: 'activo' } }),
    prisma.equipos.count({ where: { estado: 'activo' } }),
    prisma.empresas_contratistas.findMany({
      where: { estado: 'activa' },
      select: {
        id: true,
        nit: true,
        razon_social: true,
        _count: { select: { contratistas: { where: { estado: 'activo' } }, equipos: { where: { estado: 'activo' } } } },
      },
      orderBy: { contratistas: { _count: 'desc' } },
      take: 10,
    }),
  ]);

  return {
    generado_en: fechaHora(new Date()),
    por_vencer_dias: dias,
    vencidos_ultimos_dias: DIAS_VENCIDOS_ATRAS,
    solicitudes: { total: sumar(solicitudes), por_estado: porEstado(solicitudes, ESTADOS_SOLICITUD) },
    permisos: {
      total: sumar(permisos),
      por_estado: porEstado(permisos, ESTADOS_PERMISO),
      vigentes_hoy: permisosVigentes,
    },
    vencimientos: {
      documentos: { por_vencer: docsPorVencer, vencidos: docsVencidos },
      capacitaciones: { por_vencer: capsPorVencer, vencidos: capsVencidas },
    },
    totales: {
      empresas_activas: empresasActivas,
      contratistas_activos: contratistasActivos,
      equipos_activos: equiposActivos,
    },
    empresas_top: empresasTop.map((e) => ({
      id: e.id,
      nit: e.nit,
      razon_social: e.razon_social,
      contratistas: e._count.contratistas,
      equipos: e._count.equipos,
    })),
  };
}

// ---- Reportes ----
async function reporteSolicitudes(f: FiltrosReporte): Promise<Reporte> {
  validarEstado(f.estado, ESTADOS_SOLICITUD);
  const subtitulo = await lineasFiltros(f, { estado: true, fechas: true });

  const where: Prisma.solicitudes_accesoWhereInput = {};
  if (f.estado) where.estado = f.estado;
  if (f.empresa_id) where.empresa_id = f.empresa_id;
  if (f.desde) where.fecha_fin = { gte: f.desde };
  if (f.hasta) where.fecha_inicio = { lte: f.hasta };

  const datos = await prisma.solicitudes_acceso.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: LIMITE_FILAS,
    include: {
      empresas_contratistas: { select: { nit: true, razon_social: true } },
      tipos_trabajo: { select: { nombre: true } },
      solicitud_zonas: { select: { zonas: { select: { codigo: true } } } },
      _count: { select: { solicitud_contratistas: true } },
    },
  });

  const filas: Fila[] = datos.map((s) => ({
    codigo: s.codigo,
    empresa: s.empresas_contratistas.razon_social,
    tipo: s.tipos_trabajo.nombre,
    estado: s.estado,
    fecha_inicio: fechaISO(s.fecha_inicio),
    fecha_fin: fechaISO(s.fecha_fin),
    horario: `${hhmm(s.hora_inicio)} - ${hhmm(s.hora_fin)}`,
    contratistas: s._count.solicitud_contratistas,
    zonas: s.solicitud_zonas.map((z) => z.zonas.codigo).join(', '),
    creada: fechaISO(s.created_at),
  }));

  return {
    nombre: 'solicitudes',
    titulo: 'Reporte de solicitudes de acceso',
    subtitulo: avisoLimite(subtitulo, filas.length),
    columnas: [
      { clave: 'codigo', titulo: 'Codigo', ancho: 16 },
      { clave: 'empresa', titulo: 'Empresa', ancho: 28 },
      { clave: 'tipo', titulo: 'Tipo de trabajo', ancho: 24 },
      { clave: 'estado', titulo: 'Estado', ancho: 12 },
      { clave: 'fecha_inicio', titulo: 'Inicio', ancho: 12 },
      { clave: 'fecha_fin', titulo: 'Fin', ancho: 12 },
      { clave: 'horario', titulo: 'Horario', ancho: 14 },
      { clave: 'contratistas', titulo: 'Contratistas', ancho: 12 },
      { clave: 'zonas', titulo: 'Zonas', ancho: 18 },
      { clave: 'creada', titulo: 'Creada', ancho: 12 },
    ],
    filas,
  };
}

async function reportePermisos(f: FiltrosReporte): Promise<Reporte> {
  validarEstado(f.estado, ESTADOS_PERMISO);
  const subtitulo = await lineasFiltros(f, { estado: true, fechas: true });

  const where: Prisma.permisos_trabajoWhereInput = {};
  if (f.estado) where.estado = f.estado;
  if (f.empresa_id) where.solicitudes_acceso = { empresa_id: f.empresa_id };
  if (f.desde) where.fecha_fin = { gte: f.desde };
  if (f.hasta) where.fecha_inicio = { lte: f.hasta };

  const datos = await prisma.permisos_trabajo.findMany({
    where,
    orderBy: { emitido_en: 'desc' },
    take: LIMITE_FILAS,
    include: {
      solicitudes_acceso: {
        select: {
          codigo: true,
          empresas_contratistas: { select: { razon_social: true } },
          tipos_trabajo: { select: { nombre: true } },
        },
      },
    },
  });

  const filas: Fila[] = datos.map((p) => ({
    codigo: p.codigo,
    solicitud: p.solicitudes_acceso.codigo,
    empresa: p.solicitudes_acceso.empresas_contratistas.razon_social,
    tipo: p.solicitudes_acceso.tipos_trabajo.nombre,
    estado: p.estado,
    vigencia: `${fechaISO(p.fecha_inicio)} a ${fechaISO(p.fecha_fin)}`,
    horario: `${hhmm(p.hora_inicio)} - ${hhmm(p.hora_fin)}`,
    inicio_actividad: fechaHora(p.actividad_inicio_en),
    fin_actividad: fechaHora(p.actividad_fin_en),
  }));

  return {
    nombre: 'permisos',
    titulo: 'Reporte de permisos de trabajo',
    subtitulo: avisoLimite(subtitulo, filas.length),
    columnas: [
      { clave: 'codigo', titulo: 'Codigo', ancho: 16 },
      { clave: 'solicitud', titulo: 'Solicitud', ancho: 16 },
      { clave: 'empresa', titulo: 'Empresa', ancho: 28 },
      { clave: 'tipo', titulo: 'Tipo de trabajo', ancho: 24 },
      { clave: 'estado', titulo: 'Estado', ancho: 13 },
      { clave: 'vigencia', titulo: 'Vigencia', ancho: 24 },
      { clave: 'horario', titulo: 'Horario', ancho: 14 },
      { clave: 'inicio_actividad', titulo: 'Inicio actividad', ancho: 18 },
      { clave: 'fin_actividad', titulo: 'Fin actividad', ancho: 18 },
    ],
    filas,
  };
}

// Documentos y capacitaciones aprobados que vencen pronto o vencieron hace poco
async function reporteVencimientos(f: FiltrosReporte): Promise<Reporte> {
  const hoy = hoyGuatemala();
  const desde = sumarDias(hoy, -DIAS_VENCIDOS_ATRAS);
  const hasta = sumarDias(hoy, f.dias);
  const rango = { gte: desde, lte: hasta };

  const subtitulo = await lineasFiltros(f, {});
  subtitulo.push(`Vencimientos entre ${fechaISO(desde)} y ${fechaISO(hasta)}`);

  const whereDoc: Prisma.documentosWhereInput = { estado_revision: 'aprobado', fecha_vencimiento: rango };
  if (f.empresa_id) {
    whereDoc.OR = [
      { empresa_id: f.empresa_id },
      { contratistas: { empresa_id: f.empresa_id } },
      { equipos: { empresa_id: f.empresa_id } },
    ];
  }
  const whereCap: Prisma.contratista_capacitacionesWhereInput = { estado_revision: 'aprobado', fecha_vencimiento: rango };
  if (f.empresa_id) whereCap.contratistas = { empresa_id: f.empresa_id };

  const [documentos, capacitaciones] = await Promise.all([
    prisma.documentos.findMany({
      where: whereDoc,
      orderBy: { fecha_vencimiento: 'asc' },
      take: LIMITE_FILAS,
      include: {
        tipos_documento: { select: { nombre: true } },
        contratistas: {
          select: { nombres: true, apellidos: true, empresas_contratistas: { select: { razon_social: true } } },
        },
        empresas_contratistas: { select: { razon_social: true } },
        equipos: { select: { codigo: true, empresas_contratistas: { select: { razon_social: true } } } },
      },
    }),
    prisma.contratista_capacitaciones.findMany({
      where: whereCap,
      orderBy: { fecha_vencimiento: 'asc' },
      take: LIMITE_FILAS,
      include: {
        capacitaciones: { select: { nombre: true } },
        contratistas: {
          select: { nombres: true, apellidos: true, empresas_contratistas: { select: { razon_social: true } } },
        },
      },
    }),
  ]);

  const items: { vence: Date; fila: Fila }[] = [];

  const armar = (tipo: string, nombre: string, titular: string, empresa: string, vence: Date): Fila => {
    const dias = diasEntre(vence, hoy);
    return {
      tipo,
      nombre,
      titular,
      empresa,
      vence: fechaISO(vence),
      dias,
      estado: dias < 0 ? 'Vencido' : dias === 0 ? 'Vence hoy' : 'Por vencer',
    };
  };

  for (const d of documentos) {
    if (!d.fecha_vencimiento) continue;
    const titular = d.contratistas
      ? `${d.contratistas.nombres} ${d.contratistas.apellidos}`
      : d.empresas_contratistas
        ? d.empresas_contratistas.razon_social
        : `Equipo ${d.equipos?.codigo ?? ''}`.trim();
    const empresa =
      d.contratistas?.empresas_contratistas.razon_social ??
      d.empresas_contratistas?.razon_social ??
      d.equipos?.empresas_contratistas.razon_social ??
      '';
    items.push({ vence: d.fecha_vencimiento, fila: armar('Documento', d.tipos_documento.nombre, titular, empresa, d.fecha_vencimiento) });
  }

  for (const c of capacitaciones) {
    if (!c.fecha_vencimiento) continue;
    items.push({
      vence: c.fecha_vencimiento,
      fila: armar(
        'Capacitacion',
        c.capacitaciones.nombre,
        `${c.contratistas.nombres} ${c.contratistas.apellidos}`,
        c.contratistas.empresas_contratistas.razon_social,
        c.fecha_vencimiento,
      ),
    });
  }

  items.sort((a, b) => a.vence.getTime() - b.vence.getTime());
  const filas = items.slice(0, LIMITE_FILAS).map((i) => i.fila);

  return {
    nombre: 'vencimientos',
    titulo: 'Reporte de vencimientos de documentos y capacitaciones',
    subtitulo: avisoLimite(subtitulo, filas.length),
    columnas: [
      { clave: 'tipo', titulo: 'Tipo', ancho: 14 },
      { clave: 'nombre', titulo: 'Documento / capacitacion', ancho: 30 },
      { clave: 'titular', titulo: 'Titular', ancho: 28 },
      { clave: 'empresa', titulo: 'Empresa', ancho: 28 },
      { clave: 'vence', titulo: 'Vence', ancho: 12 },
      { clave: 'dias', titulo: 'Dias', ancho: 8 },
      { clave: 'estado', titulo: 'Estado', ancho: 12 },
    ],
    filas,
  };
}

async function reporteContratistas(f: FiltrosReporte): Promise<Reporte> {
  validarEstado(f.estado, ESTADOS_CONTRATISTA);
  const subtitulo = await lineasFiltros(f, { estado: true });

  const where: Prisma.contratistasWhereInput = {};
  if (f.estado) where.estado = f.estado;
  if (f.empresa_id) where.empresa_id = f.empresa_id;

  const datos = await prisma.contratistas.findMany({
    where,
    orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    take: LIMITE_FILAS,
    include: { empresas_contratistas: { select: { nit: true, razon_social: true } } },
  });

  const filas: Fila[] = datos.map((c) => ({
    documento: c.documento_identidad,
    nombre: `${c.apellidos}, ${c.nombres}`,
    empresa: c.empresas_contratistas.razon_social,
    nit: c.empresas_contratistas.nit,
    cargo: c.cargo,
    email: c.email,
    telefono: c.telefono,
    estado: c.estado,
  }));

  return {
    nombre: 'contratistas',
    titulo: 'Reporte de contratistas por empresa',
    subtitulo: avisoLimite(subtitulo, filas.length),
    columnas: [
      { clave: 'documento', titulo: 'Documento', ancho: 16 },
      { clave: 'nombre', titulo: 'Nombre', ancho: 28 },
      { clave: 'empresa', titulo: 'Empresa', ancho: 28 },
      { clave: 'nit', titulo: 'NIT', ancho: 12 },
      { clave: 'cargo', titulo: 'Cargo', ancho: 20 },
      { clave: 'email', titulo: 'Correo', ancho: 26 },
      { clave: 'telefono', titulo: 'Telefono', ancho: 14 },
      { clave: 'estado', titulo: 'Estado', ancho: 10 },
    ],
    filas,
  };
}

export async function generar(tipo: TipoReporte, filtros: FiltrosReporte): Promise<Reporte> {
  switch (tipo) {
    case 'solicitudes':
      return reporteSolicitudes(filtros);
    case 'permisos':
      return reportePermisos(filtros);
    case 'vencimientos':
      return reporteVencimientos(filtros);
    case 'contratistas':
      return reporteContratistas(filtros);
  }
}