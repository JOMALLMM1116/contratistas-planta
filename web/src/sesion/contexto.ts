import { createContext, useContext } from 'react'

// Perfil tal como lo devuelve el backend en /api/auth/login y /api/auth/me
export interface RolPerfil {
  codigo: string
  nombre: string
  es_interno: boolean
}

export interface Perfil {
  id: string
  email: string
  nombre_completo: string
  rol: RolPerfil
  permisos: string[]
  empresa_id: string | null
  contratista_id: string | null
}

export interface ValorSesion {
  /** Usuario con sesión, o null si no ha iniciado sesión */
  perfil: Perfil | null
  /** true mientras se consulta /auth/me al abrir la aplicación */
  cargando: boolean
  /**
   * true si el usuario cerró sesión a propósito (botón "Cerrar sesión").
   * En ese caso el siguiente inicio de sesión va al Inicio, no a la última página visitada.
   */
  salidaVoluntaria: boolean
  iniciarSesion: (email: string, password: string) => Promise<Perfil>
  cerrarSesion: () => Promise<void>
  recargarPerfil: () => Promise<void>
}

export const ContextoSesion = createContext<ValorSesion | null>(null)

/** Acceso a la sesión desde cualquier componente */
export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion)
  if (!valor) throw new Error('useSesion debe usarse dentro de <SesionProvider>')
  return valor
}
