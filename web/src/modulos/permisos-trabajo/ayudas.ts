import type { EstadoPermiso, MomentoEvidencia } from './tipos'

/** Las horas llegan como "HH:MM"; por si llegaran como fecha ISO, se toma solo la hora */
export function hora(valor: string): string {
  return /^\d{2}:\d{2}/.test(valor) ? valor.slice(0, 5) : valor.slice(11, 16)
}

export const TEXTO_MOMENTO: Record<MomentoEvidencia, string> = {
  inicio: 'Inicio',
  durante: 'Durante',
  cierre: 'Cierre',
}

/** Solo un permiso emitido o en ejecución se puede revocar (regla del backend) */
export const puedeRevocarse = (estado: EstadoPermiso) => estado === 'emitido' || estado === 'en_ejecucion'