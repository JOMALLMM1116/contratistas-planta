import type { Incidente, Severidad } from './tipos'

export const TEXTO_SEVERIDAD: Record<Severidad, string> = {
  leve: 'Leve',
  moderado: 'Moderado',
  grave: 'Grave',
  critico: 'Crítico',
}

/** A quién afecta el incidente: puede tener contratista, empresa y solicitud */
export function afectadosDe(i: Incidente) {
  const lista: { tipo: string; nombre: string; detalle: string }[] = []
  if (i.contratista) {
    lista.push({ tipo: 'Contratista', nombre: `${i.contratista.nombres} ${i.contratista.apellidos}`, detalle: i.contratista.documento_identidad })
  }
  if (i.empresa) {
    lista.push({ tipo: 'Empresa', nombre: i.empresa.razon_social, detalle: `NIT ${i.empresa.nit}` })
  }
  if (i.solicitud) {
    lista.push({ tipo: 'Solicitud', nombre: i.solicitud.codigo, detalle: '' })
  }
  return lista
}

/** Fecha y hora actual con el formato de <input type="datetime-local"> (hora del navegador) */
export function ahoraLocal(): string {
  const ahora = new Date()
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset())
  return ahora.toISOString().slice(0, 16)
}