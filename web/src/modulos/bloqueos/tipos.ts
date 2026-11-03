export type TipoBloqueo = 'documento_vencido' | 'incidente' | 'manual'

interface UsuarioResumen {
  id: string
  nombre_completo: string
  email: string
}

export interface Bloqueo {
  id: string
  contratista_id: string | null
  empresa_id: string | null
  tipo: TipoBloqueo
  motivo: string
  incidente_id: string | null
  creado_por: string
  creado_en: string
  levantado_por: string | null
  levantado_en: string | null
  motivo_levantamiento: string | null
  /** true mientras no se levante */
  activo: boolean
  contratista: { id: string; nombres: string; apellidos: string; documento_identidad: string } | null
  empresa: { id: string; nit: string; razon_social: string } | null
  incidente: { id: string; codigo: string; severidad: string; estado: string } | null
  creado_por_usuario: UsuarioResumen
  levantado_por_usuario: UsuarioResumen | null
}

export const TEXTO_TIPO: Record<TipoBloqueo, string> = {
  documento_vencido: 'Documento vencido',
  incidente: 'Incidente',
  manual: 'Manual',
}

/** A quién se bloquea: se elige en el formulario */
export interface Objetivo {
  tipo: 'contratista' | 'empresa'
  id: string
  nombre: string
  detalle: string
}

/** Lo que se envía al crear (exactamente uno de contratista_id o empresa_id) */
export interface DatosBloqueo {
  tipo: 'manual'
  motivo: string
  contratista_id?: string
  empresa_id?: string
}