import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'
import { useSesion } from './contexto'
import { tienePermiso } from './permisos'
import PaginaSinPermiso from '../componentes/PaginaSinPermiso'

interface Props {
  /** Si se indica, basta con tener uno de estos permisos */
  permisos?: string[]
  /** Si no se pasa, se muestran las rutas hijas (<Outlet />) */
  children?: ReactNode
}

export default function RutaProtegida({ permisos, children }: Props) {
  const { perfil, cargando, salidaVoluntaria } = useSesion()
  const ubicacion = useLocation()

  // Mientras se pregunta a /auth/me si hay sesión
  if (cargando) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center">
        <Spinner animation="border" variant="primary" role="status">
          <span className="visually-hidden">Cargando…</span>
        </Spinner>
      </div>
    )
  }

  // Sin sesión: al login. Solo se recuerda la página si la sesión expiró o nunca hubo sesión;
  // si el usuario cerró sesión a propósito, el siguiente entra al Inicio (cambio de turno en garita)
  if (!perfil) {
    const estado = salidaVoluntaria ? undefined : { desde: ubicacion.pathname + ubicacion.search }
    return <Navigate to="/login" replace state={estado} />
  }

  // Con sesión pero sin el permiso requerido
  if (permisos && !tienePermiso(perfil, ...permisos)) {
    return <PaginaSinPermiso />
  }

  return children ?? <Outlet />
}
