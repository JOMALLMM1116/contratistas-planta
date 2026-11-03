export type EstadoRevision = 'pendiente' | 'aprobado' | 'rechazado'

export interface RegistroCapacitacion {
  id: string
  contratista_id: string
  capacitacion_id: number
  fecha_realizacion: string
  fecha_vencimiento: string | null
  archivo_id: string | null
  estado_revision: EstadoRevision
  revisado_por: string | null
  revisado_en: string | null
  created_at: string
  contratistas: { id: string; nombres: string; apellidos: string; documento_identidad: string }
  capacitaciones: { id: number; codigo: string; nombre: string; vigencia_meses: number | null }
  archivos: { id: string; nombre_original: string; mime_type: string } | null
}

/** Capacitación tal como la devuelve /capacitaciones (solo lo que usa el filtro) */
export interface CapacitacionOpcion {
  id: number
  codigo: string
  nombre: string
}