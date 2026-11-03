import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, alPerderSesion } from '../api/cliente'
import type { RespuestaDatos } from '../api/tipos'
import { ContextoSesion, type Perfil, type ValorSesion } from './contexto'

export default function SesionProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)
  const [salidaVoluntaria, setSalidaVoluntaria] = useState(false)

  // Pregunta al backend quién es el usuario (lee la cookie de sesión)
  const recargarPerfil = useCallback(async () => {
    try {
      const respuesta = await api.get<RespuestaDatos<Perfil>>('/auth/me')
      setPerfil(respuesta.datos)
    } catch {
      setPerfil(null)
    }
  }, [])

  // Al abrir la aplicación: ¿ya hay sesión?
  useEffect(() => {
    recargarPerfil().finally(() => setCargando(false))
  }, [recargarPerfil])

  // Si el cliente de la API no pudo renovar la sesión (expiró), se cierra en pantalla.
  // No es salida voluntaria: al volver a entrar, regresa a la página donde estaba.
  useEffect(() => alPerderSesion(() => setPerfil(null)), [])

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const respuesta = await api.post<RespuestaDatos<{ usuario: Perfil }>>('/auth/login', { email, password })
    setSalidaVoluntaria(false)
    setPerfil(respuesta.datos.usuario)
    return respuesta.datos.usuario
  }, [])

  const cerrarSesion = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      // Ambos cambios en el mismo render: la ruta protegida ya sabe que fue a propósito
      setSalidaVoluntaria(true)
      setPerfil(null)
    }
  }, [])

  const valor = useMemo<ValorSesion>(
    () => ({ perfil, cargando, salidaVoluntaria, iniciarSesion, cerrarSesion, recargarPerfil }),
    [perfil, cargando, salidaVoluntaria, iniciarSesion, cerrarSesion, recargarPerfil],
  )

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
}
