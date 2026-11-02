import { Badge } from 'react-bootstrap'
import { infoEstado, type EntidadEstado } from '../utilidades/estados'

interface Props {
  entidad: EntidadEstado
  estado: string
}

/** Estado con texto + color + icono (nunca solo color) */
export default function EstadoBadge({ entidad, estado }: Props) {
  const { texto, variante, icono: Icono } = infoEstado(entidad, estado)
  const neutro = variante === 'neutro'

  return (
    <Badge
      bg={neutro ? 'body-tertiary' : `${variante}-subtle`}
      text={neutro ? 'body-secondary' : `${variante}-emphasis`}
      className={`d-inline-flex align-items-center gap-1 fw-semibold${neutro ? ' border' : ''}`}
    >
      <Icono size={13} aria-hidden="true" />
      {texto}
    </Badge>
  )
}
