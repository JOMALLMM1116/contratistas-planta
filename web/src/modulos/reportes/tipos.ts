export type TipoReporte = 'solicitudes' | 'permisos' | 'vencimientos' | 'contratistas'
export type FormatoReporte = 'json' | 'excel' | 'pdf'

export interface ColumnaReporte {
  clave: string
  titulo: string
  ancho?: number
}

/** Campo "datos" de GET /reportes/:tipo?formato=json */
export interface Reporte {
  titulo: string
  subtitulo: string[]
  columnas: ColumnaReporte[]
  /** Cada fila es un objeto indexado por "clave" (se acepta también un arreglo por posición) */
  filas: unknown[]
}

export interface RespuestaReporte {
  datos: Reporte
  total: number
}

export interface EmpresaOpcion {
  id: string
  nit: string
  razon_social: string
}

export interface FiltrosReporte {
  tipo: TipoReporte
  empresa_id: string
  estado: string
  desde: string
  hasta: string
  dias: string
}