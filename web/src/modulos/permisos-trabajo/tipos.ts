import type { SolicitudResumen } from '../solicitudes/tipos'

export type EstadoPermiso = 'emitido' | 'en_ejecucion' | 'cerrado' | 'revocado' | 'vencido'
export type MomentoEvidencia = 'inicio' | 'durante' | 'cierre'

interface EmpresaResumen {
  id: string
  nit: string
  razon_social: string
}

interface TipoTrabajoResumen {
  id: number
  codigo: string
  nombre: string
}

interface SolicitudDelPermiso {
  id: string
  codigo: string
  descripcion_actividad: string
  empresas_contratistas: EmpresaResumen
  tipos_trabajo: TipoTrabajoResumen
}

/** Elemento de la lista de /permisos-trabajo */
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
  revocado_en: string | null
  motivo_revocacion: string | null
  solicitudes_acceso: SolicitudDelPermiso
  _count?: { evidencias_trabajo: number }
}

export interface EvidenciaPermiso {
  id: string
  archivo_id: string
  momento: MomentoEvidencia
  descripcion: string | null
  created_at: string
  archivos: { id: string; nombre_original: string; mime_type: string }
}

/** Detalle: GET /permisos-trabajo/:id */
export interface PermisoDetalle extends Permiso {
  evidencias_trabajo: EvidenciaPermiso[]
}

/** Solicitud aprobada tal como la devuelve /solicitudes (solo lo que usa el selector) */
export type SolicitudAprobada = Pick<
  SolicitudResumen,
  | 'id'
  | 'codigo'
  | 'tipo_trabajo_id'
  | 'descripcion_actividad'
  | 'fecha_inicio'
  | 'fecha_fin'
  | 'hora_inicio'
  | 'hora_fin'
  | 'empresas_contratistas'
  | 'tipos_trabajo'
>
