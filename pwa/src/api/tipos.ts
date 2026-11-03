// Formatos de respuesta del backend (ver docs/api.md)

/** Respuesta simple: { datos: ... } */
export interface RespuestaDatos<T> {
  datos: T
}

/** Metadatos de una lista paginada */
export interface MetaPaginacion {
  total: number
  pagina: number
  por_pagina: number
  total_paginas: number
}

/** Respuesta paginada: { datos: [...], meta: {...} } */
export interface RespuestaPaginada<T> {
  datos: T[]
  meta: MetaPaginacion
}

/** Cuerpo de error del backend: { error: { code, message, details? } } */
export interface CuerpoError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
