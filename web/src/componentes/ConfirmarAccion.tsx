import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'

interface Props {
  mostrar: boolean
  titulo: string
  /** Qué va a pasar si confirma (ej. "La credencial dejará de funcionar en garita") */
  mensaje: ReactNode
  textoConfirmar: string
  variante?: 'primary' | 'success' | 'danger' | 'warning'
  /** true si el backend exige motivo (rechazar, revocar, cancelar...) */
  pedirMotivo?: boolean
  etiquetaMotivo?: string
  procesando?: boolean
  /** Error devuelto por el backend al confirmar */
  error?: string | null
  alConfirmar: (motivo: string) => void
  alCancelar: () => void
}

/** Confirmación de acciones sensibles, con motivo opcional */
export default function ConfirmarAccion({
  mostrar,
  titulo,
  mensaje,
  textoConfirmar,
  variante = 'primary',
  pedirMotivo = false,
  etiquetaMotivo = 'Motivo',
  procesando = false,
  error,
  alConfirmar,
  alCancelar,
}: Props) {
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza limpio
  useEffect(() => {
    if (mostrar) {
      setMotivo('')
      setIntentado(false)
    }
  }, [mostrar])

  const motivoInvalido = pedirMotivo && motivo.trim().length < 3

  function confirmar() {
    setIntentado(true)
    if (motivoInvalido) return
    alConfirmar(motivo.trim())
  }

  return (
    <Modal show={mostrar} onHide={procesando ? undefined : alCancelar} backdrop={procesando ? 'static' : true} centered>
      <Modal.Header closeButton={!procesando}>
        <Modal.Title as="h2" className="h5">
          {titulo}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="mb-3">{mensaje}</div>

        {pedirMotivo && (
          <Form.Group controlId="motivo-confirmacion">
            <Form.Label>{etiquetaMotivo}</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              isInvalid={intentado && motivoInvalido}
              disabled={procesando}
            />
            <Form.Control.Feedback type="invalid">Escribe el motivo (al menos 3 caracteres).</Form.Control.Feedback>
          </Form.Group>
        )}

        {error && (
          <Alert variant="danger" className="py-2 mt-3 mb-0">
            {error}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={alCancelar} disabled={procesando}>
          Cancelar
        </Button>
        <Button variant={variante} onClick={confirmar} disabled={procesando} className="d-inline-flex align-items-center gap-2">
          {procesando && <Spinner animation="border" size="sm" />}
          {textoConfirmar}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
