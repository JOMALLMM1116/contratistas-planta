import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button, Spinner } from 'react-bootstrap'
import { useSesion } from './contexto'

/**
 * Sin sesión: al login (recordando la página, salvo que cerró sesión a propósito).
 * Personal interno: la PWA es para contratistas y supervisores; se le indica usar la Web.
 */
export default function RutaProtegida() {
  const { perfil, cargando, salidaVoluntaria, cerrarSesion } = useSesion()
  const ubicacion = useLocation()

  if (cargando) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center">
        <Spinner animation="border" variant="primary" role="status">
          <span className="visually-hidden">Cargando…</span>
        </Spinner>
      </div>
    )
  }

  if (!perfil) {
    const estado = salidaVoluntaria ? undefined : { desde: ubicacion.pathname + ubicacion.search }
    return <Navigate to="/login" replace state={estado} />
  }

  if (perfil.rol.es_interno) {
    return (
      <main className="container py-5 text-center" style={{ maxWidth: 480 }}>
        <h1 className="h5 mb-3">Esta aplicación es para contratistas</h1>
        <p className="text-body-secondary">
          Tu cuenta ({perfil.rol.nombre}) es de personal de la planta. Usa la aplicación Web.
        </p>
        <div className="d-grid gap-2">
          {/* Enlace normal (fuera del router de la PWA): la Web está en la raíz del dominio */}
          <a href="/" className="btn btn-primary">
            Ir a la Web
          </a>
          <Button variant="outline-secondary" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </Button>
        </div>
      </main>
    )
  }

  return <Outlet />
}
