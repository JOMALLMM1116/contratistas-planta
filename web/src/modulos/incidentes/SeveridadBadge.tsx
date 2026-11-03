import { Badge } from 'react-bootstrap'
import { TriangleAlert } from 'lucide-react'
import { TEXTO_SEVERIDAD } from './ayudas'
import type { Severidad } from './tipos'

const VARIANTE: Record<Severidad, 'info' | 'warning' | 'danger'> = {
  leve: 'info',
  moderado: 'warning',
  grave: 'danger',
  critico: 'danger',
}

/** Severidad con texto + color + icono (nunca solo color). El crítico lleva borde para distinguirlo del grave. */
export default function SeveridadBadge({ severidad }: { severidad: Severidad }) {
  const variante = VARIANTE[severidad] ?? 'info'
  return (
    <Badge
      bg={`${variante}-subtle`}
      text={`${variante}-emphasis`}
      className={`d-inline-flex align-items-center gap-1 fw-semibold${severidad === 'critico' ? ' border border-danger' : ''}`}
    >
      <TriangleAlert size={13} aria-hidden="true" />
      {TEXTO_SEVERIDAD[severidad] ?? severidad}
    </Badge>
  )
}