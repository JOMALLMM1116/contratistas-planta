import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap'
import { ErrorApi } from '../../api/cliente'
import SelectorEmpresa from '../../componentes/SelectorEmpresa'
import type { Contratista, DatosContratista } from './tipos'

interface Props {
  mostrar: boolean
  /** null = contratista nuevo */
  contratista: Contratista | null
  procesando: boolean
  /** Error devuelto por el backend al guardar */
  error: unknown
  alGuardar: (datos: DatosContratista) => void
  alCancelar: () => void
}

type Campo = keyof DatosContratista
type Valores = Record<Campo, string>
type Errores = Partial<Record<Campo, string>>

const VACIO: Valores = { empresa_id: '', documento_identidad: '', nombres: '', apellidos: '', email: '', telefono: '', cargo: '' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function valoresDe(c: Contratista | null): Valores {
  if (!c) return VACIO
  return {
    empresa_id: c.empresa_id,
    documento_identidad: c.documento_identidad,
    nombres: c.nombres,
    apellidos: c.apellidos,
    email: c.email ?? '',
    telefono: c.telefono ?? '',
    cargo: c.cargo ?? '',
  }
}

// Mismas reglas básicas que el backend; el resto lo valida el servidor
function validar(v: Valores): Errores {
  const errores: Errores = {}
  if (!v.empresa_id) errores.empresa_id = 'Selecciona la empresa.'
  if (v.documento_identidad.trim().length < 5) errores.documento_identidad = 'Escribe el documento de identidad (al menos 5 caracteres).'
  if (v.nombres.trim().length < 2) errores.nombres = 'Escribe los nombres (al menos 2 caracteres).'
  if (v.apellidos.trim().length < 2) errores.apellidos = 'Escribe los apellidos (al menos 2 caracteres).'
  if (v.email.trim() && !EMAIL.test(v.email.trim())) errores.email = 'El correo no es válido.'
  return errores
}

export default function ContratistaFormulario({ mostrar, contratista, procesando, error, alGuardar, alCancelar }: Props) {
  const [valores, setValores] = useState<Valores>(VACIO)
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza con los datos del contratista (o vacío)
  useEffect(() => {
    if (!mostrar) return
    setIntentado(false)
    setValores(valoresDe(contratista))
  }, [mostrar, contratista])

  const errores = intentado ? validar(valores) : {}

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (Object.keys(validar(valores)).length > 0) return

    const opcional = (texto: string) => texto.trim() || null
    alGuardar({
      empresa_id: valores.empresa_id,
      documento_identidad: valores.documento_identidad.trim(),
      nombres: valores.nombres.trim(),
      apellidos: valores.apellidos.trim(),
      email: opcional(valores.email),
      telefono: opcional(valores.telefono),
      cargo: opcional(valores.cargo),
    })
  }

  const campo = (nombre: Exclude<Campo, 'empresa_id'>, etiqueta: string, opciones: { requerido?: boolean; tipo?: string; max: number }) => (
    <Col xs={12} md={6}>
      <Form.Group controlId={`contratista-${nombre}`}>
        <Form.Label>
          {etiqueta}
          {opciones.requerido && <span className="text-danger"> *</span>}
        </Form.Label>
        <Form.Control
          type={opciones.tipo ?? 'text'}
          value={valores[nombre]}
          maxLength={opciones.max}
          onChange={(e) => setValores((v) => ({ ...v, [nombre]: e.target.value }))}
          isInvalid={!!errores[nombre]}
          disabled={procesando}
        />
        <Form.Control.Feedback type="invalid">{errores[nombre]}</Form.Control.Feedback>
      </Form.Group>
    </Col>
  )

  return (
    <Modal show={mostrar} onHide={procesando ? undefined : alCancelar} backdrop={procesando ? 'static' : true} size="lg" fullscreen="sm-down" centered>
      <Form onSubmit={enviar} noValidate>
        <Modal.Header closeButton={!procesando}>
          <Modal.Title as="h2" className="h5">
            {contratista ? 'Editar contratista' : 'Nuevo contratista'}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Row className="g-3">
            <Col xs={12}>
              <SelectorEmpresa
                id="contratista-empresa"
                etiqueta="Empresa"
                requerido
                valor={valores.empresa_id}
                actual={contratista ? { id: contratista.empresa_id, razon_social: contratista.empresas_contratistas.razon_social } : null}
                error={errores.empresa_id}
                deshabilitado={procesando}
                alCambiar={(empresa_id) => setValores((v) => ({ ...v, empresa_id }))}
              />
            </Col>
            {campo('documento_identidad', 'Documento de identidad', { requerido: true, max: 30 })}
            {campo('cargo', 'Cargo', { max: 100 })}
            {campo('nombres', 'Nombres', { requerido: true, max: 100 })}
            {campo('apellidos', 'Apellidos', { requerido: true, max: 100 })}
            {campo('email', 'Correo', { tipo: 'email', max: 254 })}
            {campo('telefono', 'Teléfono', { tipo: 'tel', max: 30 })}
          </Row>

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
          <Button type="submit" variant="primary" disabled={procesando} className="d-inline-flex align-items-center gap-2">
            {procesando && <Spinner animation="border" size="sm" />}
            {contratista ? 'Guardar cambios' : 'Crear contratista'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}