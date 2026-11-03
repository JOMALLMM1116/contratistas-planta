import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Form, InputGroup, ListGroup, Modal, Spinner } from 'react-bootstrap'
import { Search, X } from 'lucide-react'
import { ErrorApi } from '../../api/cliente'
import { formatearDia } from '../../utilidades/fechas'
import { hora } from './ayudas'
import { useSolicitudesPendientesDePermiso, type DatosEmision } from './permisos.api'
import type { SolicitudAprobada } from './tipos'

interface Props {
  mostrar: boolean
  procesando: boolean
  /** Error devuelto por el backend al emitir */
  error: unknown
  alEmitir: (datos: DatosEmision) => void
  alCancelar: () => void
}

function Vigencia({ s }: { s: SolicitudAprobada }) {
  return (
    <span className="numeros-tabulares">
      {formatearDia(s.fecha_inicio)} – {formatearDia(s.fecha_fin)} · {hora(s.hora_inicio)} – {hora(s.hora_fin)}
    </span>
  )
}

export default function PermisoEmitir({ mostrar, procesando, error, alEmitir, alCancelar }: Props) {
  const [texto, setTexto] = useState('')
  const [buscar, setBuscar] = useState('')
  const [elegida, setElegida] = useState<SolicitudAprobada | null>(null)
  const [condiciones, setCondiciones] = useState('')
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza limpio
  useEffect(() => {
    if (!mostrar) return
    setTexto('')
    setBuscar('')
    setElegida(null)
    setCondiciones('')
    setIntentado(false)
  }, [mostrar])

  // Espera a que se deje de escribir antes de consultar
  useEffect(() => {
    const espera = setTimeout(() => setBuscar(texto.trim()), 300)
    return () => clearTimeout(espera)
  }, [texto])

  const pendientes = useSolicitudesPendientesDePermiso(buscar, mostrar && elegida === null)
  const opciones = pendientes.solicitudes
  const errorSolicitud = intentado && !elegida ? 'Selecciona la solicitud aprobada.' : undefined

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (!elegida) return
    const notas = condiciones.trim()
    alEmitir({ solicitud_id: elegida.id, ...(notas ? { condiciones_especiales: notas } : {}) })
  }

  return (
    <Modal show={mostrar} onHide={procesando ? undefined : alCancelar} backdrop={procesando ? 'static' : true} size="lg" fullscreen="sm-down" centered>
      <Form onSubmit={enviar} noValidate>
        <Modal.Header closeButton={!procesando}>
          <Modal.Title as="h2" className="h5">
            Emitir permiso de trabajo
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="form-label">
            Solicitud aprobada<span className="text-danger"> *</span>
          </div>

          {elegida ? (
            <div className="d-flex align-items-start justify-content-between gap-2 border rounded px-3 py-2 mb-3">
              <div className="text-break">
                <div className="fw-semibold">
                  {elegida.codigo} · {elegida.empresas_contratistas.razon_social}
                </div>
                <div className="text-body">{elegida.tipos_trabajo.nombre}</div>
                <div className="text-body">{elegida.descripcion_actividad}</div>
                <div className="text-body">
                  <Vigencia s={elegida} />
                </div>
              </div>
              <Button variant="outline-secondary" size="sm" title="Cambiar" aria-label="Cambiar solicitud" disabled={procesando} onClick={() => setElegida(null)}>
                <X size={16} aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <div className="mb-3">
              <InputGroup>
                <InputGroup.Text>
                  <Search size={16} aria-hidden="true" />
                </InputGroup.Text>
                <Form.Control
                  type="search"
                  autoComplete="off"
                  placeholder="Filtrar por código de solicitud o empresa"
                  aria-label="Filtrar solicitudes pendientes de permiso"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  isInvalid={!!errorSolicitud}
                  disabled={procesando}
                />
              </InputGroup>
              {errorSolicitud && <div className="text-danger small mt-1">{errorSolicitud}</div>}

              <ListGroup className="mt-2" style={{ maxHeight: 240, overflowY: 'auto' }}>
                {pendientes.cargando && <ListGroup.Item disabled>Cargando solicitudes…</ListGroup.Item>}
                {pendientes.error && (
                  <ListGroup.Item className="text-danger">
                    {pendientes.error instanceof ErrorApi ? pendientes.error.message : 'No se pudieron cargar las solicitudes. Intenta de nuevo.'}
                  </ListGroup.Item>
                )}
                {pendientes.listo && !pendientes.cargando && opciones.length === 0 && (
                  <ListGroup.Item disabled>
                    {buscar ? `Ninguna solicitud pendiente de permiso coincide con «${buscar}»` : 'No hay solicitudes pendientes de permiso'}
                  </ListGroup.Item>
                )}
                {opciones.map((s) => (
                  // .list-group-item-action pinta el texto con el gris auxiliar: text-body lo deja como texto normal.
                  // Mientras se emite (deshabilitado) se quita, para que vuelva el gris de Bootstrap y se note
                  <ListGroup.Item
                    key={s.id}
                    action
                    disabled={procesando}
                    className={procesando ? undefined : 'text-body'}
                    onClick={() => setElegida(s)}
                  >
                    <div className="fw-semibold">
                      {s.codigo} · {s.empresas_contratistas.razon_social}
                    </div>
                    <div>{s.tipos_trabajo.nombre}</div>
                    <div>
                      <Vigencia s={s} />
                    </div>
                  </ListGroup.Item>
                ))}
                {pendientes.buscandoMas && !pendientes.cargando && (
                  <ListGroup.Item disabled className="small">
                    Buscando más…
                  </ListGroup.Item>
                )}
              </ListGroup>
              {pendientes.cortada && !pendientes.cargando && (
                <Form.Text className="text-body-secondary d-block">Hay más solicitudes: escribe para acotar.</Form.Text>
              )}
              <Form.Text className="text-body-secondary d-block">
                Solo aparecen solicitudes aprobadas, de un tipo de trabajo que requiere permiso y sin permiso emitido.
                {pendientes.permisosIncompletos && ' Si alguna ya tuviera permiso, el servidor lo indicará al emitir.'}
              </Form.Text>
            </div>
          )}

          <Form.Group controlId="permiso-condiciones">
            <Form.Label>Condiciones especiales</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={2000}
              value={condiciones}
              onChange={(e) => setCondiciones(e.target.value)}
              disabled={procesando}
            />
            <Form.Text className="text-body-secondary">Opcional. Quedan registradas en el permiso.</Form.Text>
          </Form.Group>

          {error ? (
            <Alert variant="danger" className="py-2 mt-3 mb-0">
              {error instanceof ErrorApi ? error.message : 'No se pudo emitir el permiso. Intenta de nuevo.'}
            </Alert>
          ) : null}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={alCancelar} disabled={procesando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={procesando} className="d-inline-flex align-items-center gap-2">
            {procesando && <Spinner animation="border" size="sm" />}
            Emitir permiso
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}