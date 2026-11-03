import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap'
import { ErrorApi } from '../../api/cliente'
import type { CambiosUsuario, DatosNuevoUsuario, EmpresaOpcion, Rol, Usuario } from './tipos'

interface Props {
  mostrar: boolean
  /** null = usuario nuevo */
  usuario: Usuario | null
  roles: Rol[]
  empresas: EmpresaOpcion[]
  /** true si el usuario que se edita es el de la sesión: el backend no permite cambiarse el rol */
  esPropio: boolean
  procesando: boolean
  /** Error devuelto por el backend al guardar */
  error: unknown
  alCrear: (datos: DatosNuevoUsuario) => void
  alEditar: (cambios: CambiosUsuario) => void
  alCancelar: () => void
}

type Campo = 'nombre' | 'email' | 'rol' | 'empresa' | 'password'
type Errores = Partial<Record<Campo, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function UsuarioFormulario({ mostrar, usuario, roles, empresas, esPropio, procesando, error, alCrear, alEditar, alCancelar }: Props) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rolId, setRolId] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [password, setPassword] = useState('')
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza con los datos del usuario (o vacío)
  useEffect(() => {
    if (!mostrar) return
    setIntentado(false)
    setNombre(usuario?.nombre_completo ?? '')
    setEmail(usuario?.email ?? '')
    setRolId(usuario ? String(usuario.rol_id) : '')
    setEmpresaId(usuario?.empresa_id ?? '')
    setPassword('')
  }, [mostrar, usuario])

  const rolElegido = roles.find((r) => String(r.id) === rolId)
  // Un rol externo exige empresa; uno interno no la usa
  const externo = rolElegido ? !rolElegido.es_interno : false

  // Empresas activas (más la actual del usuario, aunque esté inactiva, para que el valor siga válido)
  const opcionesEmpresa = empresas.filter((e) => e.estado === 'activa' || e.id === usuario?.empresa_id)

  function validar(): Errores {
    const e: Errores = {}
    if (nombre.trim().length < 3) e.nombre = 'Escribe el nombre completo (al menos 3 caracteres).'
    if (!usuario) {
      if (!EMAIL.test(email.trim())) e.email = 'Escribe un correo válido.'
      if (password.length < 8) e.password = 'La contraseña debe tener al menos 8 caracteres.'
      else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = 'Debe incluir al menos una letra y un número.'
    }
    if (!rolElegido) e.rol = 'Selecciona el rol.'
    else if (externo && !empresaId) e.empresa = 'Un rol externo exige una empresa.'
    return e
  }

  const errores = intentado ? validar() : {}

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (Object.keys(validar()).length > 0 || !rolElegido) return

    const nuevaEmpresa = externo ? empresaId : null

    if (!usuario) {
      alCrear({
        email: email.trim(),
        nombre_completo: nombre.trim(),
        rol_id: rolElegido.id,
        empresa_id: nuevaEmpresa,
        password,
      })
      return
    }

    // Solo se envía lo que cambió: así editar tu propio nombre no choca con las reglas de tu propia cuenta
    const cambios: CambiosUsuario = {}
    if (nombre.trim() !== usuario.nombre_completo) cambios.nombre_completo = nombre.trim()
    if (rolElegido.id !== usuario.rol_id) cambios.rol_id = rolElegido.id
    if (nuevaEmpresa !== usuario.empresa_id) cambios.empresa_id = nuevaEmpresa

    if (Object.keys(cambios).length === 0) {
      alCancelar()
      return
    }
    alEditar(cambios)
  }

  return (
    <Modal show={mostrar} onHide={procesando ? undefined : alCancelar} backdrop={procesando ? 'static' : true} size="lg" fullscreen="sm-down" centered>
      <Form onSubmit={enviar} noValidate>
        <Modal.Header closeButton={!procesando}>
          <Modal.Title as="h2" className="h5">
            {usuario ? 'Editar usuario' : 'Nuevo usuario'}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Row className="g-3">
            <Col xs={12} md={6}>
              <Form.Group controlId="usuario-nombre">
                <Form.Label>
                  Nombre completo<span className="text-danger"> *</span>
                </Form.Label>
                <Form.Control value={nombre} maxLength={150} onChange={(e) => setNombre(e.target.value)} isInvalid={!!errores.nombre} disabled={procesando} />
                <Form.Control.Feedback type="invalid">{errores.nombre}</Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="usuario-email">
                <Form.Label>
                  Correo{!usuario && <span className="text-danger"> *</span>}
                </Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  maxLength={254}
                  onChange={(e) => setEmail(e.target.value)}
                  isInvalid={!!errores.email}
                  disabled={procesando || usuario !== null}
                />
                <Form.Control.Feedback type="invalid">{errores.email}</Form.Control.Feedback>
                {usuario && <Form.Text className="text-body-secondary">El correo no se puede cambiar.</Form.Text>}
              </Form.Group>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="usuario-rol">
                <Form.Label>
                  Rol<span className="text-danger"> *</span>
                </Form.Label>
                <Form.Select value={rolId} onChange={(e) => setRolId(e.target.value)} isInvalid={!!errores.rol} disabled={procesando || esPropio}>
                  <option value="">Selecciona un rol…</option>
                  {roles.map((rol) => (
                    <option key={rol.id} value={rol.id}>
                      {rol.nombre}
                      {rol.es_interno ? '' : ' (externo)'}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errores.rol}</Form.Control.Feedback>
                {esPropio && <Form.Text className="text-body-secondary">No puedes cambiar tu propio rol.</Form.Text>}
              </Form.Group>
            </Col>

            {externo && (
              <Col xs={12} md={6}>
                <Form.Group controlId="usuario-empresa">
                  <Form.Label>
                    Empresa<span className="text-danger"> *</span>
                  </Form.Label>
                  <Form.Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} isInvalid={!!errores.empresa} disabled={procesando}>
                    <option value="">Selecciona una empresa…</option>
                    {opcionesEmpresa.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>
                        {empresa.razon_social} ({empresa.nit})
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errores.empresa}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            )}

            {!usuario && (
              <Col xs={12} md={6}>
                <Form.Group controlId="usuario-password">
                  <Form.Label>
                    Contraseña<span className="text-danger"> *</span>
                  </Form.Label>
                  <Form.Control
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    maxLength={100}
                    onChange={(e) => setPassword(e.target.value)}
                    isInvalid={!!errores.password}
                    disabled={procesando}
                  />
                  <Form.Control.Feedback type="invalid">{errores.password}</Form.Control.Feedback>
                  <Form.Text className="text-body-secondary">Mínimo 8 caracteres, con al menos una letra y un número.</Form.Text>
                </Form.Group>
              </Col>
            )}
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
            {usuario ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}