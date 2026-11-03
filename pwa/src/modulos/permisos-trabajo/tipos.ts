export type EstadoPermiso = 'emitido' | 'en_ejecucion' | 'cerrado' | 'revocado' | 'vencido'
export type MomentoEvidencia = 'inicio' | 'durante' | 'cierre'

export interface Permiso {
  id: string
  codigo: string
  solicitud_id: string
  /** Columnas DATE: "2026-11-01T00:00:00.000Z" → usar formatearDia */
  fecha_inicio: string
  fecha_fin: string
  /** "HH:MM" */
  hora_inicio: string
  hora_fin: string
  estado: EstadoPermiso
  condiciones_especiales: string | null
  emitido_en: string
  actividad_inicio_en: string | null
  actividad_fin_en: string | null
  motivo_revocacion: string | null
  solicitudes_acceso: {
    id: string
    codigo: string
    descripcion_actividad: string
    empresas_contratistas: { id: string; nit: string; razon_social: string }
    tipos_trabajo: { id: number; codigo: string; nombre: string }
  }
}

/** Detalle: GET /permisos-trabajo/:id (vigente lo calcula la base) */
export interface PermisoDetalle extends Permiso {
  vigente: boolean
}

export interface ItemChecklist {
  item_id: number
  orden: number
  descripcion: string
  obligatorio: boolean
  /** null = sin responder */
  cumple: boolean | null
  observacion: string | null
}

export interface ChecklistContratista {
  contratista_id: string
  nombre: string
  /** Puntos obligatorios que faltan o no cumplen */
  pendientes: number
  items: ItemChecklist[]
}

/** GET /permisos-trabajo/:id/checklist */
export interface Checklist {
  completo: boolean
  total_items: number
  contratistas: ChecklistContratista[]
}

export interface RespuestaItem {
  contratista_id: string
  item_id: number
  cumple: boolean
  observacion: string | null
}

export interface Evidencia {
  id: string
  archivo_id: string
  momento: MomentoEvidencia
  descripcion: string | null
  created_at: string
  archivos: { id: string; nombre_original: string; mime_type: string }
}