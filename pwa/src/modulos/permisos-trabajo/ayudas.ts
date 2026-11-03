import type { MomentoEvidencia } from './tipos'

/** Las horas llegan como "HH:MM"; por si llegaran como fecha ISO, se toma solo la hora */
export function hora(valor: string): string {
  return /^\d{2}:\d{2}/.test(valor) ? valor.slice(0, 5) : valor.slice(11, 16)
}

export const TEXTO_MOMENTO: Record<MomentoEvidencia, string> = {
  inicio: 'Inicio',
  durante: 'Durante',
  cierre: 'Cierre',
}

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_BYTES = 10 * 1024 * 1024

/** El servidor valida de nuevo (incluida la firma real del archivo); esto solo evita enviar de más */
export function problemaDeArchivo(f: File): string | null {
  const tipoValido = TIPOS_PERMITIDOS.includes(f.type) || (f.type === '' && /\.(pdf|jpe?g|png)$/i.test(f.name))
  if (!tipoValido) return 'El archivo debe ser PDF, JPG o PNG.'
  if (f.size === 0) return 'El archivo está vacío.'
  if (f.size > MAX_BYTES) return 'El archivo pesa más de 10 MB.'
  return null
}

export function tamano(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}