import { Badge } from 'react-bootstrap'
import { CircleCheck, ShieldOff, TriangleAlert } from 'lucide-react'
import type { Resultado } from './tipos'

const INFO = {
  ok: { texto: 'Correcto', variante: 'success', Icono: CircleCheck },
  denegado: { texto: 'Denegado', variante: 'warning', Icono: ShieldOff },
  error: { texto: 'Error', variante: 'danger', Icono: TriangleAlert },
} as const

/** Resultado del evento con texto + color + icono (nunca solo color) */
export default function ResultadoBadge({ resultado }: { resultado: Resultado }) {
  const info = INFO[resultado]
  if (!info) {
    return (
      <Badge bg="body-tertiary" text="body-secondary" className="border fw-semibold">
        {resultado}
      </Badge>
    )
  }
  const { texto, variante, Icono } = info
  return (
    <Badge bg={`${variante}-subtle`} text={`${variante}-emphasis`} className="d-inline-flex align-items-center gap-1 fw-semibold">
      <Icono size={13} aria-hidden="true" />
      {texto}
    </Badge>
  )
}