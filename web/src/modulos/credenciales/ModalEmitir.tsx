import { useEffect, useState } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'

type ModoUsos = 'ilimitado' | 'uno' | 'otro'

interface Props {
  mostrar: boolean
  nombreContratista: string
  /** Fecha y hora fin de la solicitud, para explicar hasta cuándo vale */
  vigenciaHasta: string
  procesando: boolean
  error?: string | null
  /** undefined = ilimitados */
  alEmitir: (usosMaximos?: number) => void
  alCancelar: () => void
}

export default function ModalEmitir({ mostrar, nombreContratista, vigenciaHasta, procesando, error, alEmitir, alCancelar }: Props) {
  const [modo, setModo] = useState<ModoUsos>('ilimitado')
  const [cantidad, setCantidad] = useState('2')
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza con la opción por defecto
  useEffect(() => {
    if (mostrar) {
      setModo('ilimitado')
      setCantidad('2')
      setIntentado(false)
    }
  }, [mostrar])

  const numero = Number(cantidad)
  const cantidadInvalida = modo === 'otro' && (!Number.isInteger(numero) || numero < 1 || numero > 50)

  function emitir() {
    setIntentado(true)
    if (cantidadInvalida) return
    alEmitir(modo === 'ilimitado' ? undefined : modo === 'uno' ? 1 : numero)
  }

  return (
    <Modal show={mostrar} onHide={procesando ? undefined : alCancelar} backdrop={procesando ? 'static' : true} centered>
      <Modal.Header closeButton={!procesando}>
        <Modal.Title as="h2" className="h5">
          Emitir credencial
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="mb-3">
          Credencial para <strong>{nombreContratista}</strong>, válida hasta el <strong>{vigenciaHasta}</strong>.
        </p>

        <Form.Group>
          <Form.Label>Ingresos permitidos</Form.Label>
          <Form.Check
            type="radio"
            id="usos-ilimitado"
            name="usos"
            label="Ilimitados durante la vigencia"
            checked={modo === 'ilimitado'}
            onChange={() => setModo('ilimitado')}
            disabled={procesando}
          />
          <Form.Check
            type="radio"
            id="usos-uno"
            name="usos"
            label="Un solo ingreso"
            checked={modo === 'uno'}
            onChange={() => setModo('uno')}
            disabled={procesando}
          />
          <Form.Check
            type="radio"
            id="usos-otro"
            name="usos"
            label="Otra cantidad"
            checked={modo === 'otro'}
            onChange={() => setModo('otro')}
            disabled={procesando}
          />
          {modo === 'otro' && (
            <Form.Group controlId="usos-cantidad" className="mt-2" style={{ maxWidth: 160 }}>
              <Form.Control
                type="number"
                min={1}
                max={50}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                isInvalid={intentado && cantidadInvalida}
                disabled={procesando}
              />
              <Form.Control.Feedback type="invalid">Escribe un número del 1 al 50.</Form.Control.Feedback>
            </Form.Group>
          )}
        </Form.Group>

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
        <Button onClick={emitir} disabled={procesando} className="d-inline-flex align-items-center gap-2">
          {procesando && <Spinner animation="border" size="sm" />}
          Emitir credencial
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
