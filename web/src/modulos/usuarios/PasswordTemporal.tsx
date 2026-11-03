import { useEffect, useState } from 'react'
import { Alert, Button, Modal } from 'react-bootstrap'
import { Check, Copy } from 'lucide-react'

interface Props {
  /** null = cerrado */
  datos: { nombre: string; password: string } | null
  alCerrar: () => void
}

/** Muestra la contraseña temporal UNA sola vez: el backend no la vuelve a entregar */
export default function PasswordTemporal({ datos, alCerrar }: Props) {
  const [copiada, setCopiada] = useState(false)
  const [falloCopiar, setFalloCopiar] = useState(false)

  useEffect(() => {
    setCopiada(false)
    setFalloCopiar(false)
  }, [datos])

  async function copiar() {
    if (!datos) return
    try {
      await navigator.clipboard.writeText(datos.password)
      setCopiada(true)
      setFalloCopiar(false)
    } catch {
      setFalloCopiar(true)
    }
  }

  return (
    <Modal show={datos !== null} onHide={alCerrar} backdrop="static" centered>
      <Modal.Header>
        <Modal.Title as="h2" className="h5">
          Contraseña temporal
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="mb-2">
          Nueva contraseña de <strong>{datos?.nombre}</strong>:
        </p>
        <div className="font-monospace fs-4 fw-semibold text-center border rounded p-3 user-select-all text-break" aria-label="Contraseña temporal">
          {datos?.password}
        </div>

        <div className="d-grid mt-3">
          <Button variant={copiada ? 'success' : 'outline-secondary'} className="d-inline-flex align-items-center justify-content-center gap-2" onClick={() => void copiar()}>
            {copiada ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copiada ? 'Copiada' : 'Copiar contraseña'}
          </Button>
        </div>
        {falloCopiar && <div className="text-danger small mt-2">No se pudo copiar automáticamente: selecciónala y cópiala a mano.</div>}

        <Alert variant="warning" className="py-2 mt-3 mb-0">
          Entrégala por un medio seguro. <strong>No se volverá a mostrar</strong>. Se cerraron las sesiones abiertas del usuario y deberá cambiarla en su próximo ingreso.
        </Alert>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="primary" onClick={alCerrar}>
          Listo
        </Button>
      </Modal.Footer>
    </Modal>
  )
}