import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap'
import type { DatosEvaluacion } from './solicitudes.api'

// Mismas reglas que evaluarSolicitudSchema del backend
const esquema = z.object({
  nivel_riesgo: z.enum(['bajo', 'medio', 'alto', 'critico']),
  peligros_identificados: z.string().trim().min(3, 'Describe los peligros (al menos 3 caracteres)').max(2000),
  medidas_control: z.string().trim().min(3, 'Describe las medidas (al menos 3 caracteres)').max(2000),
  epp_requerido: z.string().trim().max(1000, 'Máximo 1000 caracteres'),
  resultado: z.enum(['aprobada', 'condicionada', 'rechazada']),
})

type Formulario = z.infer<typeof esquema>

const VALORES_INICIALES: Formulario = {
  nivel_riesgo: 'medio',
  peligros_identificados: '',
  medidas_control: '',
  epp_requerido: '',
  resultado: 'aprobada',
}

interface Props {
  mostrar: boolean
  procesando: boolean
  error?: string | null
  alGuardar: (datos: DatosEvaluacion) => void
  alCancelar: () => void
}

export default function ModalEvaluacion({ mostrar, procesando, error, alGuardar, alCancelar }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<Formulario>({ resolver: zodResolver(esquema), defaultValues: VALORES_INICIALES })

  // Cada vez que se abre, el formulario empieza limpio
  useEffect(() => {
    if (mostrar) reset(VALORES_INICIALES)
  }, [mostrar, reset])

  const nivel = watch('nivel_riesgo')
  const resultado = watch('resultado')

  const guardar = handleSubmit((datos) => {
    alGuardar({ ...datos, epp_requerido: datos.epp_requerido || undefined })
  })

  return (
    <Modal show={mostrar} onHide={procesando ? undefined : alCancelar} backdrop={procesando ? 'static' : true} centered size="lg">
      <Form noValidate onSubmit={guardar}>
        <Modal.Header closeButton={!procesando}>
          <Modal.Title as="h2" className="h5">
            Evaluación de riesgo
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Row className="g-3">
            <Col sm={6}>
              <Form.Group controlId="nivel_riesgo">
                <Form.Label>Nivel de riesgo</Form.Label>
                <Form.Select {...register('nivel_riesgo')} disabled={procesando}>
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                  <option value="critico">Crítico</option>
                </Form.Select>
                {(nivel === 'alto' || nivel === 'critico') && (
                  <Form.Text>Con riesgo alto o crítico se necesitan 2 aprobaciones de personas distintas.</Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group controlId="resultado">
                <Form.Label>Resultado</Form.Label>
                <Form.Select {...register('resultado')} disabled={procesando}>
                  <option value="aprobada">Aprobada</option>
                  <option value="condicionada">Condicionada</option>
                  <option value="rechazada">Rechazada</option>
                </Form.Select>
                {resultado === 'rechazada' && (
                  <Form.Text className="text-danger">La solicitud quedará rechazada.</Form.Text>
                )}
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="peligros_identificados">
                <Form.Label>Peligros identificados</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  isInvalid={!!errors.peligros_identificados}
                  disabled={procesando}
                  {...register('peligros_identificados')}
                />
                <Form.Control.Feedback type="invalid">{errors.peligros_identificados?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="medidas_control">
                <Form.Label>Medidas de control</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  isInvalid={!!errors.medidas_control}
                  disabled={procesando}
                  {...register('medidas_control')}
                />
                <Form.Control.Feedback type="invalid">{errors.medidas_control?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="epp_requerido">
                <Form.Label>
                  EPP requerido <span className="text-body-secondary">(opcional)</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  isInvalid={!!errors.epp_requerido}
                  disabled={procesando}
                  {...register('epp_requerido')}
                />
                <Form.Control.Feedback type="invalid">{errors.epp_requerido?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

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
          <Button type="submit" disabled={procesando} className="d-inline-flex align-items-center gap-2">
            {procesando && <Spinner animation="border" size="sm" />}
            Guardar evaluación
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
