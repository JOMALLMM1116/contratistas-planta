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

/** 2026-11-02 o un timestamp → 02/11/2026 */
export function formatearFecha(valor?: string | Date | null): string {
  if (!valor) return '—'

  // Una fecha sin hora ("2026-11-02") se muestra tal cual. Si se convirtiera con
  // new Date(), JavaScript la toma como medianoche UTC y en Guatemala saldría el día anterior.
  if (typeof valor === 'string') {
    const partes = SOLO_FECHA.exec(valor)
    if (partes) return `${partes[3]}/${partes[2]}/${partes[1]}`
  }

  const fecha = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? '—' : formatoFecha.format(fecha)
}

/** Timestamp → 02/11/2026 14:35 */
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
