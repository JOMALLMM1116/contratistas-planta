import type { ReactNode } from 'react'

interface Props {
  titulo: string
  descripcion?: string
  /** Botones a la derecha (ej. "Nueva solicitud") */
  acciones?: ReactNode
}

export default function EncabezadoPagina({ titulo, descripcion, acciones }: Props) {
  return (
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <h1 className="h3 mb-1">{titulo}</h1>
        {descripcion && <p className="text-body-secondary mb-0">{descripcion}</p>}
      </div>
      {acciones && <div className="d-flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}
