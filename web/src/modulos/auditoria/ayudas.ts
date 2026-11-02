import type { EntidadEstado } from '../../utilidades/estados'

/** Entidades con historial de estados en el backend, y el mapa de estados que usa EstadoBadge para cada una */
export const ENTIDADES_HISTORIAL: { valor: string; texto: string; estados: EntidadEstado }[] = [
  { valor: 'solicitud', texto: 'Solicitud de acceso', estados: 'solicitud' },
  { valor: 'permiso_trabajo', texto: 'Permiso de trabajo', estados: 'permiso_trabajo' },
  { valor: 'credencial', texto: 'Credencial', estados: 'credencial' },
  { valor: 'incidente', texto: 'Incidente', estados: 'incidente' },
  { valor: 'documento', texto: 'Documento', estados: 'revision' },
  { valor: 'contratista_capacitacion', texto: 'Capacitación de contratista', estados: 'revision' },
]

/** Sugerencias para el filtro de entidad (el filtro acepta cualquier texto exacto) */
export const ENTIDADES_AUDITORIA = [
  'usuarios',
  'sesiones',
  'incidente',
  'bloqueos',
  'documento',
  'contratista_capacitacion',
  'credenciales',
  'permiso_trabajo',
  'registros_acceso',
  'tokens_recuperacion_password',
]

/** Sugerencias para el filtro de acción (el filtro busca por coincidencia parcial) */
export const ACCIONES_AUDITORIA = [
  'LOGIN',
  'ACCESO_DENEGADO',
  'PASSWORD_CAMBIADO',
  'USUARIO_CREADO',
  'USUARIO_ROL_CAMBIADO',
  'USUARIO_PASSWORD_RESTABLECIDA',
  'INCIDENTE_CREADO',
  'INCIDENTE_CERRADO',
  'BLOQUEO_CREADO',
  'BLOQUEO_LEVANTADO',
]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esUuid(valor: string | null | undefined): valor is string {
  return !!valor && UUID.test(valor)
}