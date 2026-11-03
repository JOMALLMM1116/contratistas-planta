export type Severidad = 'leve' | 'moderado' | 'grave' | 'critico'
export type EstadoIncidente = 'abierto' | 'en_investigacion' | 'cerrado'

interface UsuarioResumen {
  id: string
  nombre_completo: string
  email: string
}

export interface ArchivoResumen {
  id: string
  nombre_original: string
  mime_type: string
}

export interface Incidente {
  id: string
  codigo: string
  contratista_id: string | null
  empresa_id: string | null
  solicitud_id: string | null
  zona_id: number | null
  severidad: Severidad
  descripcion: string
  fecha_ocurrencia: string
  estado: EstadoIncidente
  acciones_correctivas: string | null
  reportado_por: string
  cerrado_por: string | null
  cerrado_en: string | null
  created_at: string
  updated_at: string
  contratista: { id: string; nombres: string; apellidos: string; documento_identidad: string } | null
  empresa: { id: string; nit: string; razon_social: string } | null
  solicitud: { id: string; codigo: string } | null
  zona: { id: number; codigo: string; nombre: string } | null
  reportado_por_usuario: UsuarioResumen
  cerrado_por_usuario: UsuarioResumen | null
  evidencias: ArchivoResumen[]
}

/** Archivo tal como lo devuelve /archivos (solo lo que usa el buscador de evidencias) */
export interface ArchivoOpcion {
  id: string
  nombre_original: string
  mime_type: string
  created_at: string
}

export interface ZonaOpcion {
  id: number
  codigo: string
  nombre: string
}

/** Lo que se envía al reportar un incidente (reportado_por lo pone el servidor) */
export interface DatosIncidente {
  contratista_id?: string
  empresa_id?: string
  zona_id?: number
  severidad: Severidad
  descripcion: string
  fecha_ocurrencia?: string
}