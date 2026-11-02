import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, Col, Row, Spinner, Table } from 'react-bootstrap'
import { ArrowLeft, Ban, CircleCheck, CircleX, ClipboardCheck, Send } from 'lucide-react'
import EstadoBadge from '../../componentes/EstadoBadge'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { ErrorApi } from '../../api/cliente'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { formatearDia, formatearFechaHora } from '../../utilidades/fechas'
import { useAccionesSolicitud, useRequisitos, useSolicitud } from './solicitudes.api'
import ModalEvaluacion from './ModalEvaluacion'

type Accion = 'enviar' | 'evaluar' | 'aprobar' | 'rechazar' | 'cancelar'

const NIVEL_RIESGO: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' }
const RESULTADO: Record<string, string> = { aprobada: 'Aprobada', condicionada: 'Condicionada', rechazada: 'Rechazada' }

const EN_REVISION = ['pendiente', 'en_revision']
const CANCELABLE = ['borrador', 'pendiente', 'en_revision']

function mensajeError(error: unknown): string | null {
  if (!error) return null
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la acción.'
}

/** Etiqueta y valor */
function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <div className="small text-body-secondary">{etiqueta}</div>
      <div>{children}</div>
    </div>
  )
}

export default function SolicitudDetallePagina() {
  const { id = '' } = useParams()
  const { perfil } = useSesion()
  const solicitud = useSolicitud(id)
  const requisitos = useRequisitos(id)
  const acciones = useAccionesSolicitud(id)
  const [accion, setAccion] = useState<Accion | null>(null)

  if (solicitud.isPending) return <Cargando />
  if (solicitud.isError) {
    return (
      <>
        <Link to="/solicitudes" className="d-inline-flex align-items-center gap-1 mb-3">
          <ArrowLeft size={16} /> Solicitudes
        </Link>
        <ErrorCarga error={solicitud.error} alReintentar={() => void solicitud.refetch()} />
      </>
    )
  }

  const s = solicitud.data
  const puede = (permiso: string) => tienePermiso(perfil, permiso)

  // Botones según estado y permisos (el backend vuelve a validar todo)
  const puedeEnviar = s.estado === 'borrador' && puede('solicitudes.crear')
  const puedeEvaluar = EN_REVISION.includes(s.estado) && puede('riesgos.evaluar')
  const puedeAutorizar = EN_REVISION.includes(s.estado) && puede('solicitudes.autorizar')
  const puedeCancelar = CANCELABLE.includes(s.estado) && puede('solicitudes.crear')

  const faltaEvaluacion =
    s.tipos_trabajo.requiere_evaluacion_riesgo && s.evaluaciones_riesgo.length === 0 && EN_REVISION.includes(s.estado)
  const conFaltantes = (requisitos.data ?? []).filter((r) => r.faltantes.length > 0)

  function abrir(nueva: Accion) {
    // Al abrir un diálogo, se limpia el error de un intento anterior
    acciones.enviar.reset()
    acciones.cancelar.reset()
    acciones.evaluar.reset()
    acciones.autorizar.reset()
    setAccion(nueva)
  }
  const cerrar = () => setAccion(null)

  return (
    <>
      <Link to="/solicitudes" className="d-inline-flex align-items-center gap-1 mb-3">
        <ArrowLeft size={16} /> Solicitudes
      </Link>

      {/* Encabezado con acciones */}
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <h1 className="h3 mb-0">{s.codigo}</h1>
            <EstadoBadge entidad="solicitud" estado={s.estado} />
          </div>
          <p className="text-body-secondary mb-0">{s.empresas_contratistas.razon_social}</p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          {puedeEnviar && (
            <Button className="d-inline-flex align-items-center gap-2" onClick={() => abrir('enviar')}>
              <Send size={16} /> Enviar
            </Button>
          )}
          {puedeEvaluar && (
            <Button variant="outline-primary" className="d-inline-flex align-items-center gap-2" onClick={() => abrir('evaluar')}>
              <ClipboardCheck size={16} /> Evaluar riesgo
            </Button>
          )}
          {puedeAutorizar && (
            <>
              <Button variant="success" className="d-inline-flex align-items-center gap-2" onClick={() => abrir('aprobar')}>
                <CircleCheck size={16} /> Aprobar
              </Button>
              <Button variant="outline-danger" className="d-inline-flex align-items-center gap-2" onClick={() => abrir('rechazar')}>
                <CircleX size={16} /> Rechazar
              </Button>
            </>
          )}
          {puedeCancelar && (
            <Button variant="outline-secondary" className="d-inline-flex align-items-center gap-2" onClick={() => abrir('cancelar')}>
              <Ban size={16} /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Avisos */}
      {s.estado === 'rechazada' && s.motivo_rechazo && (
        <Alert variant="danger">
          <strong>Motivo del rechazo:</strong> {s.motivo_rechazo}
        </Alert>
      )}
      {faltaEvaluacion && (
        <Alert variant="warning">Este tipo de trabajo requiere evaluación de riesgo antes de autorizar.</Alert>
      )}
      {EN_REVISION.includes(s.estado) && conFaltantes.length > 0 && (
        <Alert variant="warning">
          Hay contratistas con documentos o capacitaciones pendientes: la solicitud no podrá aprobarse hasta que estén al día.
        </Alert>
      )}

      <Row className="g-3">
        {/* Columna principal */}
        <Col lg={8}>
          <Card className="shadow-sm mb-3">
            <Card.Body>
              <h2 className="h6 mb-3">Datos de la solicitud</h2>
              <Row className="g-3">
                <Col sm={6}>
                  <Dato etiqueta="Empresa">
                    {s.empresas_contratistas.razon_social}
                    <div className="small text-body-secondary">NIT {s.empresas_contratistas.nit}</div>
                  </Dato>
                </Col>
                <Col sm={6}>
                  <Dato etiqueta="Tipo de trabajo">
                    {s.tipos_trabajo.nombre}
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {s.tipos_trabajo.requiere_permiso_trabajo && (
                        <Badge bg="info-subtle" text="info-emphasis">
                          Requiere permiso de trabajo
                        </Badge>
                      )}
                      {s.tipos_trabajo.requiere_evaluacion_riesgo && (
                        <Badge bg="warning-subtle" text="warning-emphasis">
                          Requiere evaluación de riesgo
                        </Badge>
                      )}
                    </div>
                  </Dato>
                </Col>
                <Col sm={6}>
                  <Dato etiqueta="Vigencia">
                    {formatearDia(s.fecha_inicio)} – {formatearDia(s.fecha_fin)}
                  </Dato>
                </Col>
                <Col sm={6}>
                  <Dato etiqueta="Horario">
                    {s.hora_inicio} – {s.hora_fin}
                  </Dato>
                </Col>
                <Col xs={12}>
                  <Dato etiqueta="Actividad">{s.descripcion_actividad}</Dato>
                </Col>
                <Col sm={6}>
                  <Dato etiqueta="Creada">{formatearFechaHora(s.created_at)}</Dato>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm mb-3">
            <Card.Body className="pb-0">
              <h2 className="h6 mb-3">Contratistas y requisitos</h2>
            </Card.Body>
            {s.solicitud_contratistas.length === 0 ? (
              <Card.Body className="pt-0 text-body-secondary">La solicitud no tiene contratistas.</Card.Body>
            ) : (
              <Table responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th>Requisitos</th>
                  </tr>
                </thead>
                <tbody>
                  {s.solicitud_contratistas.map(({ contratistas: c }) => {
                    const req = requisitos.data?.find((r) => r.contratista_id === c.id)
                    return (
                      <tr key={c.id}>
                        <td>
                          {c.nombres} {c.apellidos}
                        </td>
                        <td className="numeros-tabulares">{c.documento_identidad}</td>
                        <td>
                          {requisitos.isPending ? (
                            <Spinner animation="border" size="sm" />
                          ) : !req ? (
                            <span className="text-body-secondary">—</span>
                          ) : req.faltantes.length === 0 ? (
                            <Badge bg="success-subtle" text="success-emphasis">
                              Al día
                            </Badge>
                          ) : (
                            <ul className="list-unstyled mb-0 small text-danger-emphasis">
                              {req.faltantes.map((f, i) => (
                                <li key={i}>
                                  {f.nombre}: {f.motivo}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <Card className="shadow-sm mb-3">
            <Card.Body>
              <h2 className="h6 mb-3">Evaluaciones de riesgo</h2>
              {s.evaluaciones_riesgo.length === 0 ? (
                <p className="text-body-secondary mb-0">Sin evaluaciones.</p>
              ) : (
                s.evaluaciones_riesgo.map((e) => (
                  <div key={e.id} className="border rounded p-3 mb-2">
                    <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                      <Badge bg="body-tertiary" text="body-secondary" className="border">
                        Riesgo {NIVEL_RIESGO[e.nivel_riesgo] ?? e.nivel_riesgo}
                      </Badge>
                      <Badge
                        bg={e.resultado === 'rechazada' ? 'danger-subtle' : e.resultado === 'condicionada' ? 'warning-subtle' : 'success-subtle'}
                        text={e.resultado === 'rechazada' ? 'danger-emphasis' : e.resultado === 'condicionada' ? 'warning-emphasis' : 'success-emphasis'}
                      >
                        {RESULTADO[e.resultado] ?? e.resultado}
                      </Badge>
                      <span className="small text-body-secondary">{formatearFechaHora(e.created_at)}</span>
                    </div>
                    <Row className="g-2 small">
                      <Col md={6}>
                        <Dato etiqueta="Peligros">{e.peligros_identificados}</Dato>
                      </Col>
                      <Col md={6}>
                        <Dato etiqueta="Medidas de control">{e.medidas_control}</Dato>
                      </Col>
                      {e.epp_requerido && (
                        <Col xs={12}>
                          <Dato etiqueta="EPP requerido">{e.epp_requerido}</Dato>
                        </Col>
                      )}
                    </Row>
                  </div>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Columna lateral */}
        <Col lg={4}>
          <Card className="shadow-sm mb-3">
            <Card.Body>
              <h2 className="h6 mb-3">Zonas autorizadas</h2>
              {s.solicitud_zonas.length === 0 ? (
                <p className="text-body-secondary mb-0">Sin zonas.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-grid gap-2">
                  {s.solicitud_zonas.map(({ zonas: z }) => (
                    <li key={z.id} className="d-flex justify-content-between align-items-center gap-2">
                      <span>
                        <span className="fw-semibold">{z.codigo}</span> {z.nombre}
                      </span>
                      <Badge bg="body-tertiary" text="body-secondary" className="border text-nowrap">
                        Riesgo {z.nivel_riesgo}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>

          <Card className="shadow-sm mb-3">
            <Card.Body>
              <h2 className="h6 mb-3">Equipos</h2>
              {s.solicitud_equipos.length === 0 ? (
                <p className="text-body-secondary mb-0">Sin equipos.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {s.solicitud_equipos.map(({ equipos: eq }) => (
                    <li key={eq.id}>
                      <span className="fw-semibold">{eq.codigo}</span> {eq.nombre}
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>

          <Card className="shadow-sm mb-3">
            <Card.Body>
              <h2 className="h6 mb-3">Autorizaciones</h2>
              {s.autorizaciones.length === 0 ? (
                <p className="text-body-secondary mb-0">Sin autorizaciones.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-grid gap-3">
                  {s.autorizaciones.map((a) => (
                    <li key={a.id}>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-semibold">Etapa {a.etapa}</span>
                        <Badge
                          bg={a.decision === 'aprobada' ? 'success-subtle' : 'danger-subtle'}
                          text={a.decision === 'aprobada' ? 'success-emphasis' : 'danger-emphasis'}
                        >
                          {a.decision === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                        </Badge>
                      </div>
                      <div className="small text-body-secondary">{formatearFechaHora(a.decidido_en)}</div>
                      {a.comentario && <div className="small">{a.comentario}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Diálogos */}
      <ConfirmarAccion
        mostrar={accion === 'enviar'}
        titulo="Enviar solicitud"
        mensaje="La solicitud pasará a revisión de seguridad y ya no se podrá editar."
        textoConfirmar="Enviar"
        procesando={acciones.enviar.isPending}
        error={mensajeError(acciones.enviar.error)}
        alConfirmar={() => acciones.enviar.mutate(undefined, { onSuccess: cerrar })}
        alCancelar={cerrar}
      />

      <ConfirmarAccion
        mostrar={accion === 'aprobar'}
        titulo="Aprobar solicitud"
        mensaje={`Se registrará tu aprobación como etapa ${s.autorizaciones.length + 1}. Si es la última etapa requerida, la solicitud quedará aprobada.`}
        textoConfirmar="Aprobar"
        variante="success"
        procesando={acciones.autorizar.isPending}
        error={mensajeError(acciones.autorizar.error)}
        alConfirmar={() => acciones.autorizar.mutate({ decision: 'aprobada' }, { onSuccess: cerrar })}
        alCancelar={cerrar}
      />

      <ConfirmarAccion
        mostrar={accion === 'rechazar'}
        titulo="Rechazar solicitud"
        mensaje="La solicitud quedará rechazada y no podrá emitirse credencial."
        textoConfirmar="Rechazar"
        variante="danger"
        pedirMotivo
        etiquetaMotivo="Motivo del rechazo"
        procesando={acciones.autorizar.isPending}
        error={mensajeError(acciones.autorizar.error)}
        alConfirmar={(motivo) => acciones.autorizar.mutate({ decision: 'rechazada', comentario: motivo }, { onSuccess: cerrar })}
        alCancelar={cerrar}
      />

      <ConfirmarAccion
        mostrar={accion === 'cancelar'}
        titulo="Cancelar solicitud"
        mensaje="La solicitud quedará cancelada. Esta acción no se puede deshacer."
        textoConfirmar="Cancelar solicitud"
        variante="danger"
        pedirMotivo
        etiquetaMotivo="Motivo de la cancelación"
        procesando={acciones.cancelar.isPending}
        error={mensajeError(acciones.cancelar.error)}
        alConfirmar={(motivo) => acciones.cancelar.mutate(motivo, { onSuccess: cerrar })}
        alCancelar={cerrar}
      />

      <ModalEvaluacion
        mostrar={accion === 'evaluar'}
        procesando={acciones.evaluar.isPending}
        error={mensajeError(acciones.evaluar.error)}
        alGuardar={(datos) => acciones.evaluar.mutate(datos, { onSuccess: cerrar })}
        alCancelar={cerrar}
      />
    </>
  )
}
