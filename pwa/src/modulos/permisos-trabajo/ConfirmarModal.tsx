import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'

interface Props {
  mostrar: boolean
  titulo: string
  mensaje: ReactNode
  textoConfirmar: string
  variante: 'primary' | 'success' | 'danger'
  /** Campo de texto opcional (por ejemplo, observaciones del cierre); si se escribe, mínimo 3 caracteres */
  etiquetaTexto?: string
  procesando: boolean
  /** Error devuelto por el backend al confirmar */
  error: string | null
  alConfirmar: (texto: string) => void
  alCancelar: () => void
}

/** Confirmación de una acción sensible, con un texto opcional */
export default function ConfirmarModal({ mostrar, titulo, mensaje, textoConfirmar, variante, etiquetaTexto, procesando, error, alConfirmar, alCancelar }: Props) {
  const [texto, setTexto] = useState('')
  const [intentado, setIntentado] = useState(false)

  useEffect(() => {
    if (mostrar) {
      setTexto('')
      setIntentado(false)
    }
  }, [mostrar])

  const textoCorto = texto.trim() !== '' && texto.trim().length < 3

  function confirmar() {
    setIntentado(true)
    if (textoCorto) return
    alConfirmar(texto.trim())
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

        {etiquetaTexto && (
          <Form.Group controlId="confirmar-texto">
            <Form.Label>{etiquetaTexto} (opcional)</Form.Label>
            <Form.Control as="textarea" rows={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} isInvalid={intentado && textoCorto} disabled={procesando} />
            <Form.Control.Feedback type="invalid">Escribe al menos 3 caracteres o déjalo vacío.</Form.Control.Feedback>
          </Form.Group>
        )}

        {error && (
          <Alert variant="danger" className="py-2 mt-3 mb-0">
            {error}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer className="flex-nowrap">
        <Button variant="secondary" onClick={alCancelar} disabled={procesando}>
          Cancelar
        </Button>
        <Button variant={variante} onClick={confirmar} disabled={procesando} className="flex-grow-1 d-inline-flex align-items-center justify-content-center gap-2">
          {procesando && <Spinner animation="border" size="sm" />}
          {textoConfirmar}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}