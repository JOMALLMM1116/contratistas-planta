// Forma de los datos según las respuestas reales de /api/solicitudes

export const ESTADOS_SOLICITUD = [
  'borrador',
  'pendiente',
  'en_revision',
  'aprobada',
  'rechazada',
  'cancelada',
  'vencida',
  'revocada',
] as const

export interface EmpresaResumen {
  id: string
  nit: string
  razon_social: string
}

export interface TipoTrabajoResumen {
  id: number
  codigo: string
  nombre: string
}

interface SolicitudBase {
  id: string
  codigo: string
  empresa_id: string
  tipo_trabajo_id: number
  responsable_interno_id: string
  solicitada_por: string
  descripcion_actividad: string
  /** Columna DATE: "2026-11-01T00:00:00.000Z" → usar formatearDia */
  fecha_inicio: string
  fecha_fin: string
  /** "HH:MM" */
  hora_inicio: string
  hora_fin: string
  estado: string
  motivo_rechazo: string | null
  created_at: string
  updated_at: string
}

/** Elemento de la lista */
export interface SolicitudResumen extends SolicitudBase {
  empresas_contratistas: EmpresaResumen
  tipos_trabajo: TipoTrabajoResumen
  _count: { solicitud_contratistas: number; solicitud_zonas: number }
}

export interface Autorizacion {
  id: string
  solicitud_id: string
  etapa: number
  decision: 'aprobada' | 'rechazada'
  usuario_id: string
  comentario: string | null
  decidido_en: string
}

// Campos según el esquema de evaluación; se confirmarán con la primera evaluación real
export interface EvaluacionRiesgo {
  id: string
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico'
  peligros_identificados: string
  medidas_control: string
  epp_requerido: string | null
  resultado: 'aprobada' | 'condicionada' | 'rechazada'
  created_at: string
}

/** Detalle completo */
export interface SolicitudDetalle extends SolicitudBase {
  empresas_contratistas: EmpresaResumen
  tipos_trabajo: TipoTrabajoResumen & {
    requiere_permiso_trabajo: boolean
    requiere_evaluacion_riesgo: boolean
  }
  solicitud_contratistas: {
    contratistas: { id: string; nombres: string; apellidos: string; documento_identidad: string }
  }[]
  solicitud_zonas: { zonas: { id: number; codigo: string; nombre: string; nivel_riesgo: number } }[]
  solicitud_equipos: { equipos: { id: string; codigo: string; nombre: string } }[]
  evaluaciones_riesgo: EvaluacionRiesgo[]
  autorizaciones: Autorizacion[]
}

/** Requisitos faltantes por contratista (GET /solicitudes/:id/requisitos) */
export interface RequisitosContratista {
  contratista_id: string
  nombre: string
  faltantes: { tipo: string; referencia_id: number | null; nombre: string; motivo: string }[]
}
