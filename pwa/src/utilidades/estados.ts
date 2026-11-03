import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Ban,
  CalendarX,
  CheckCheck,
  CircleCheck,
  CircleDot,
  CircleMinus,
  CirclePlay,
  CircleX,
  Clock,
  FileCheck,
  Pencil,
  Search,
  ShieldOff,
  SquareCheck,
  TriangleAlert,
} from 'lucide-react'

// Estados EXACTOS del backend (CHECK de la base de datos). No inventar estados aquí.

export type Variante = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutro'

export interface InfoEstado {
  texto: string
  variante: Variante
  icono: LucideIcon
}

export type EntidadEstado = 'solicitud' | 'permiso_trabajo' | 'credencial' | 'incidente' | 'revision' | 'usuario'

const ESTADOS: Record<EntidadEstado, Record<string, InfoEstado>> = {
  solicitud: {
    borrador: { texto: 'Borrador', variante: 'neutro', icono: Pencil },
    pendiente: { texto: 'Pendiente', variante: 'info', icono: Clock },
    en_revision: { texto: 'En revisión', variante: 'warning', icono: Search },
    aprobada: { texto: 'Aprobada', variante: 'success', icono: CircleCheck },
    rechazada: { texto: 'Rechazada', variante: 'danger', icono: CircleX },
    cancelada: { texto: 'Cancelada', variante: 'neutro', icono: Ban },
    vencida: { texto: 'Vencida', variante: 'danger', icono: CalendarX },
    revocada: { texto: 'Revocada', variante: 'danger', icono: ShieldOff },
  },
  permiso_trabajo: {
    emitido: { texto: 'Emitido', variante: 'info', icono: FileCheck },
    en_ejecucion: { texto: 'En ejecución', variante: 'primary', icono: CirclePlay },
    cerrado: { texto: 'Cerrado', variante: 'neutro', icono: SquareCheck },
    revocado: { texto: 'Revocado', variante: 'danger', icono: ShieldOff },
    vencido: { texto: 'Vencido', variante: 'danger', icono: CalendarX },
  },
  credencial: {
    activa: { texto: 'Activa', variante: 'success', icono: BadgeCheck },
    usada: { texto: 'Ya utilizada', variante: 'neutro', icono: CheckCheck },
    revocada: { texto: 'Revocada', variante: 'danger', icono: ShieldOff },
    vencida: { texto: 'Vencida', variante: 'danger', icono: CalendarX },
  },
  incidente: {
    abierto: { texto: 'Abierto', variante: 'danger', icono: TriangleAlert },
    en_investigacion: { texto: 'En investigación', variante: 'warning', icono: Search },
    cerrado: { texto: 'Cerrado', variante: 'success', icono: CircleCheck },
  },
  revision: {
    pendiente: { texto: 'Pendiente de revisión', variante: 'warning', icono: Clock },
    aprobado: { texto: 'Aprobado', variante: 'success', icono: CircleCheck },
    rechazado: { texto: 'Rechazado', variante: 'danger', icono: CircleX },
  },
  usuario: {
    activo: { texto: 'Activo', variante: 'success', icono: CircleCheck },
    inactivo: { texto: 'Inactivo', variante: 'neutro', icono: CircleMinus },
  },
}

/** Texto, color e icono de un estado. Si el backend envía uno desconocido, se muestra tal cual en gris. */
export function infoEstado(entidad: EntidadEstado, estado: string): InfoEstado {
  return ESTADOS[entidad][estado] ?? { texto: estado, variante: 'neutro', icono: CircleDot }
}
