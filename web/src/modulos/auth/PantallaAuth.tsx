import type { ReactNode } from 'react'
import { Card } from 'react-bootstrap'
import { ShieldCheck } from 'lucide-react'
import BotonTema from '../../componentes/BotonTema'

interface Props {
  titulo: string
  descripcion?: string
  children: ReactNode
}

/** Marco de las pantallas públicas de contraseña: logo, botón de tema y tarjeta centrada */
export default function PantallaAuth({ titulo, descripcion, children }: Props) {
  return (
    <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-3 position-relative">
      <BotonTema className="position-absolute top-0 end-0 m-3" />

      <div className="d-flex align-items-center gap-2 mb-4 fs-4 fw-semibold">
        <ShieldCheck size={32} strokeWidth={1.75} aria-hidden="true" />
        <span>Control Planta</span>
      </div>

      <Card className="w-100" style={{ maxWidth: 440 }}>
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">{titulo}</h1>
          {descripcion && <p className="mb-4">{descripcion}</p>}
          {children}
        </Card.Body>
      </Card>
    </div>
  )
}