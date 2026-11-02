import { Alert } from 'react-bootstrap'
import { TriangleAlert } from 'lucide-react'

interface Props {
  requiereEvaluacion: boolean
  requierePermiso: boolean
  className?: string
}

/** Explica qué exige el tipo de trabajo antes de aprobar y de emitir credencial */
export default function AvisoTipoTrabajo({ requiereEvaluacion, requierePermiso, className = '' }: Props) {
  if (!requiereEvaluacion && !requierePermiso) return null

  return (
    <Alert variant="warning" className={`d-flex gap-2 py-2 mb-0 ${className}`}>
      <TriangleAlert size={20} className="flex-shrink-0 mt-1" aria-hidden="true" />
      <div>
        <div className="fw-semibold">Este tipo de trabajo exige:</div>
        <ul className="mb-0 ps-3">
          {requiereEvaluacion && <li>Evaluación de riesgo antes de aprobar la solicitud.</li>}
          {requierePermiso && <li>Permiso de trabajo vigente antes de emitir la credencial.</li>}
        </ul>
      </div>
    </Alert>
  )
}
