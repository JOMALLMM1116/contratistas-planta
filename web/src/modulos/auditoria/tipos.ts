export type Resultado = 'ok' | 'denegado' | 'error'

export interface EventoAuditoria {
  id: number
  usuario_id: string | null
  usuario_email: string | null
  accion: string
  entidad: string | null
  entidad_id: string | null
  resultado: Resultado
  datos_antes: unknown
  datos_despues: unknown
  ip: string | null
  user_agent: string | null
  created_at: string
}

export interface CambioEstado {
  id: number
  entidad: string
  entidad_id: string
  estado_anterior: string | null
  estado_nuevo: string
  motivo: string | null
  usuario_id: string | null
  created_at: string
  usuario: { id: string; email: string; nombre_completo: string } | null
}