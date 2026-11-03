import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'
import { ErrorApi } from '../../api/cliente'
import SelectorObjetivo from './SelectorObjetivo'
import type { Objetivo } from './tipos'

interface Props {
  mostrar: boolean
  procesando: boolean
  /** Error devuelto por el backend al guardar */
  error: unknown
  alGuardar: (objetivo: Objetivo, motivo: string) => void
  alCancelar: () => void
}

export default function BloqueoFormulario({ mostrar, procesando, error, alGuardar, alCancelar }: Props) {
  const [tipo, setTipo] = useState<'contratista' | 'empresa'>('contratista')
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza limpio
  useEffect(() => {
    if (!mostrar) return
    setTipo('contratista')
    setObjetivo(null)
    setMotivo('')
    setIntentado(false)
  }, [mostrar])

  const errorObjetivo = intentado && !objetivo ? 'Selecciona a quién se bloquea.' : undefined
  const errorMotivo = intentado && motivo.trim().length < 3 ? 'Escribe el motivo (al menos 3 caracteres).' : undefined

  function cambiarTipo(nuevo: 'contratista' | 'empresa') {
    setTipo(nuevo)
    setObjetivo(null)
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (!objetivo || motivo.trim().length < 3) return
    alGuardar(objetivo, motivo.trim())
  }

  return (
    <Modal show={mostrar} onHide={procesando ? undefined : alCancelar} backdrop={procesando ? 'static' : true} fullscreen="sm-down" centered>
      <Form onSubmit={enviar} noValidate>
        <Modal.Header closeButton={!procesando}>
          <Modal.Title as="h2" className="h5">
            Nuevo bloqueo
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label as="legend" className="form-label">
              ¿A quién se bloquea?
            </Form.Label>
            <div>
              <Form.Check
                inline
                type="radio"
                id="bloqueo-tipo-contratista"
                name="bloqueo-tipo"
                label="Contratista"
                checked={tipo === 'contratista'}
                onChange={() => cambiarTipo('contratista')}
                disabled={procesando}
              />
              <Form.Check
                inline
                type="radio"
                id="bloqueo-tipo-empresa"
                name="bloqueo-tipo"
                label="Empresa"
                checked={tipo === 'empresa'}
                onChange={() => cambiarTipo('empresa')}
                disabled={procesando}
              />
            </div>
          </Form.Group>

          <div className="mb-3">
            <SelectorObjetivo tipo={tipo} valor={objetivo} error={errorObjetivo} deshabilitado={procesando} alCambiar={setObjetivo} />
            {tipo === 'empresa' && (
              <Form.Text className="text-body-secondary">Se bloqueará el ingreso de todos los contratistas de la empresa.</Form.Text>
            )}
          </div>

          <Form.Group controlId="bloqueo-motivo">
            <Form.Label>
              Motivo<span className="text-danger"> *</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              isInvalid={!!errorMotivo}
              disabled={procesando}
            />
            <Form.Control.Feedback type="invalid">{errorMotivo}</Form.Control.Feedback>
          </Form.Group>

          {error ? (
            <Alert variant="danger" className="py-2 mt-3 mb-0">
              {error instanceof ErrorApi ? error.message : 'No se pudo guardar. Intenta de nuevo.'}
            </Alert>
          ) : null}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={alCancelar} disabled={procesando}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={procesando} className="d-inline-flex align-items-center gap-2">
            {procesando && <Spinner animation="border" size="sm" />}
            Bloquear
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}