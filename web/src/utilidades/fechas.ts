// Fechas siempre en hora de Guatemala (UTC-6), como el backend
const ZONA = 'America/Guatemala'

const formatoFecha = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const formatoFechaHora = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/
const INICIO_FECHA = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Columnas DATE del backend (fecha_inicio, fecha_fin, fecha_vencimiento...).
 * Prisma las envía como "2026-11-01T00:00:00.000Z": se toma solo AAAA-MM-DD,
 * SIN convertir de zona horaria (si se convirtiera, en Guatemala saldría el día anterior).
 */
export function formatearDia(valor?: string | null): string {
  if (!valor) return '—'
  const partes = INICIO_FECHA.exec(valor)
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : '—'
}

/** Momento exacto (timestamp) → 02/11/2026, en hora de Guatemala */
export function formatearFecha(valor?: string | Date | null): string {
  if (!valor) return '—'

  // Una fecha sin hora ("2026-11-02") se muestra tal cual
  if (typeof valor === 'string') {
    const partes = SOLO_FECHA.exec(valor)
    if (partes) return `${partes[3]}/${partes[2]}/${partes[1]}`
  }

  const fecha = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? '—' : formatoFecha.format(fecha)
}

/** Momento exacto (timestamp) → 02/11/2026 14:35, en hora de Guatemala */
export function formatearFechaHora(valor?: string | Date | null): string {
  if (!valor) return '—'
  const fecha = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? '—' : formatoFechaHora.format(fecha)
}

/** 135 → "2 h 15 min" */
export function formatearDuracion(minutos?: number | null): string {
  if (minutos === null || minutos === undefined) return '—'
  const horas = Math.floor(minutos / 60)
  const resto = Math.round(minutos % 60)
  return horas > 0 ? `${horas} h ${resto} min` : `${resto} min`
}

/** Fecha de hoy en Guatemala como "AAAA-MM-DD" (para valores por defecto de campos de fecha) */
export function hoyGuatemala(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA })
}
