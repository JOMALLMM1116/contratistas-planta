import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap'
import { ErrorApi } from '../../api/cliente'
import type { DatosEmpresa, Empresa } from './tipos'

interface Props {
  mostrar: boolean
  /** null = empresa nueva */
  empresa: Empresa | null
  procesando: boolean
  /** Error devuelto por el backend al guardar */
  error: unknown
  alGuardar: (datos: DatosEmpresa) => void
  alCancelar: () => void
}

type Campo = keyof DatosEmpresa
type Valores = Record<Campo, string>
type Errores = Partial<Record<Campo, string>>

const VACIO: Valores = { nit: '', razon_social: '', nombre_contacto: '', email_contacto: '', telefono: '', direccion: '' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function valoresDe(empresa: Empresa | null): Valores {
  if (!empresa) return VACIO
  return {
    nit: empresa.nit,
    razon_social: empresa.razon_social,
    nombre_contacto: empresa.nombre_contacto ?? '',
    email_contacto: empresa.email_contacto ?? '',
    telefono: empresa.telefono ?? '',
    direccion: empresa.direccion ?? '',
  }
}

// Mismas reglas básicas que el backend; el resto lo valida el servidor
function validar(v: Valores): Errores {
  const errores: Errores = {}
  if (v.nit.trim().length < 2) errores.nit = 'Escribe el NIT (al menos 2 caracteres).'
  if (v.razon_social.trim().length < 2) errores.razon_social = 'Escribe la razón social (al menos 2 caracteres).'
  if (v.email_contacto.trim() && !EMAIL.test(v.email_contacto.trim())) errores.email_contacto = 'El correo no es válido.'
  return errores
}

export default function EmpresaFormulario({ mostrar, empresa, procesando, error, alGuardar, alCancelar }: Props) {
  const [valores, setValores] = useState<Valores>(VACIO)
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza con los datos de la empresa (o vacío)
  useEffect(() => {
    if (!mostrar) return
    setIntentado(false)
    setValores(valoresDe(empresa))
  }, [mostrar, empresa])

  const errores = intentado ? validar(valores) : {}

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (Object.keys(validar(valores)).length > 0) return

    const opcional = (texto: string) => texto.trim() || null
    alGuardar({
      nit: valores.nit.trim(),
      razon_social: valores.razon_social.trim(),
      nombre_contacto: opcional(valores.nombre_contacto),
      email_contacto: opcional(valores.email_contacto),
      telefono: opcional(valores.telefono),
      direccion: opcional(valores.direccion),
    })
  }

  const campo = (nombre: Campo, etiqueta: string, opciones: { requerido?: boolean; tipo?: string; max: number; md?: number }) => (
    <Col xs={12} md={opciones.md ?? 6}>
      <Form.Group controlId={`empresa-${nombre}`}>
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
            {empresa ? 'Editar empresa' : 'Nueva empresa'}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Row className="g-3">
            {campo('nit', 'NIT', { requerido: true, max: 20 })}
            {campo('razon_social', 'Razón social', { requerido: true, max: 200 })}
            {campo('nombre_contacto', 'Persona de contacto', { max: 150 })}
            {campo('email_contacto', 'Correo de contacto', { tipo: 'email', max: 254 })}
            {campo('telefono', 'Teléfono', { tipo: 'tel', max: 30 })}
            {campo('direccion', 'Dirección', { max: 500, md: 12 })}
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
            {empresa ? 'Guardar cambios' : 'Crear empresa'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}