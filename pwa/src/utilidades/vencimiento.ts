import { hoyGuatemala } from './fechas'

/** Días de anticipación con los que se avisa que un documento está por vencer (solo para mostrar) */
export const DIAS_AVISO = 30

/**
 * Las columnas DATE llegan como "2026-11-09T00:00:00.000Z". Se deja solo la fecha: si se
 * convirtiera con zona horaria, en Guatemala saldría el día anterior.
 */
export function soloFecha(valor: string | null): string | null {
  return valor ? valor.slice(0, 10) : null
}

/** Días que faltan para la fecha (negativo = ya venció). Solo para mostrar: la validez la decide el backend. */
export function diasParaVencer(fecha: string | null): number | null {
  const dia = soloFecha(fecha)
  if (!dia) return null
  const [a, m, d] = dia.split('-').map(Number)
  const [ha, hm, hd] = hoyGuatemala().split('-').map(Number)
  return Math.round((Date.UTC(a!, m! - 1, d!) - Date.UTC(ha!, hm! - 1, hd!)) / 86_400_000)
}