import type { ReactNode } from 'react'
import { Button, Spinner } from 'react-bootstrap'
import { Inbox, RotateCw, TriangleAlert } from 'lucide-react'
import { ErrorApi } from '../api/cliente'

/** Mientras se espera la respuesta del servidor */
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center gap-2 py-5 text-body-secondary" role="status">
      <Spinner animation="border" variant="primary" />
      <span>{texto}</span>
    </div>
  )
}

/** La consulta funcionó pero no hay registros */
export function SinDatos({
  titulo = 'Sin resultados',
  descripcion,
  accion,
}: {
  titulo?: string
  descripcion?: string
  accion?: ReactNode
}) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center gap-2 py-5">
      <Inbox size={40} className="text-body-secondary" aria-hidden="true" />
      <h2 className="h6 mb-0">{titulo}</h2>
      {descripcion && <p className="text-body-secondary mb-0">{descripcion}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  )
}

/** La consulta falló: muestra el mensaje del backend y permite reintentar */
export function ErrorCarga({ error, alReintentar }: { error: unknown; alReintentar?: () => void }) {
  const mensaje = error instanceof ErrorApi ? error.message : 'No se pudo cargar la información.'

  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center gap-2 py-5" role="alert">
      <TriangleAlert size={40} className="text-danger" aria-hidden="true" />
      <h2 className="h6 mb-0">No se pudo cargar</h2>
      <p className="text-body-secondary mb-0">{mensaje}</p>
      {alReintentar && (
        <Button variant="outline-primary" size="sm" className="d-inline-flex align-items-center gap-1 mt-2" onClick={alReintentar}>
          <RotateCw size={16} /> Reintentar
        </Button>
      )}
    </div>
  )
}
