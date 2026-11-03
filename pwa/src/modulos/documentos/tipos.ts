export type EstadoRevision = 'pendiente' | 'aprobado' | 'rechazado'

export interface Documento {
  id: string
  tipo_documento_id: number
  contratista_id: string | null
  empresa_id: string | null
  equipo_id: string | null
  numero: string | null
  /** Columnas DATE: "2026-11-09T00:00:00.000Z" → usar formatearDia */
  fecha_emision: string | null
  fecha_vencimiento: string | null
  archivo_id: string
  estado_revision: EstadoRevision
  revisado_en: string | null
  observaciones: string | null
  created_at: string
  tipos_documento: { id: number; codigo: string; nombre: string; aplica_a: 'contratista' | 'empresa' | 'equipo' }
  archivos: { id: string; nombre_original: string; mime_type: string }
  contratistas: { id: string; nombres: string; apellidos: string; documento_identidad: string } | null
  empresas_contratistas: { id: string; nit: string; razon_social: string } | null
  equipos: { id: string; codigo: string; nombre: string } | null
}

/** Tipo de documento tal como lo devuelve /tipos-documento */
export interface TipoDocumentoOpcion {
  id: number
  codigo: string
  nombre: string
  aplica_a: string
  requiere_vencimiento: boolean
  dias_alerta_vencimiento: number
}

/** Lo que se envía a POST /documentos (quién sube lo pone el servidor) */
export interface DatosDocumento {
  tipo_documento_id: number
  numero?: string
  fecha_emision?: string
  fecha_vencimiento?: string
}