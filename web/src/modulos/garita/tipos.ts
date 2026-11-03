// Forma de los datos según las respuestas reales de /api/garita

/** Los 9 resultados posibles de /garita/validar y /garita/entrada */
export type ResultadoGarita =
  | 'valido'
  | 'vencido'
  | 'revocado'
  | 'usado'
  | 'invalido'
  | 'bloqueado'
  | 'documentos_vencidos'
  | 'fuera_de_horario'
  | 'zona_no_autorizada'

export interface RespuestaValidacion {
  resultado: string
  permitido: boolean
  motivo: string
  zona?: { id: number; codigo: string; nombre: string } | null
  credencial?: {
    id: string
    codigo_corto: string
    estado: string
    expira_en: string
    usos_maximos: number | null
    usos_actuales: number
  } | null
  contratista?: {
    id: string
    nombres: string
    apellidos: string
    documento_identidad: string
    empresa_id: string
  } | null
  empresa?: { id: string; nit: string; razon_social: string } | null
  solicitud?: { id: string; codigo: string; estado: string; descripcion_actividad: string } | null
}

/** /garita/entrada devuelve lo mismo y además si quedó registrada */
export interface RespuestaEntrada extends RespuestaValidacion {
  registrado: boolean
}

/** Lo que identifica la credencial: el token del QR o el código corto (solo uno) */
export type Identificador = { token: string } | { codigo: string }

export interface ZonaGarita {
  id: number
  codigo: string
  nombre: string
  nivel_riesgo: number
  activa: boolean
}
