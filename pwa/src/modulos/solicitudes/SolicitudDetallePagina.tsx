import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Card } from 'react-bootstrap'
import { ArrowLeft, CircleCheck, FileUp } from 'lucide-react'
import EstadoBadge from '../../componentes/EstadoBadge'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { useSesion } from '../../sesion/contexto'
import { formatearDia } from '../../utilidades/fechas'
import { hora, textoTipoRequisito } from './ayudas'
import PermisoDeSolicitud from './PermisoDeSolicitud'
import { useRequisitos, useSolicitud } from './solicitudes.api'

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="small fw-semibold">{etiqueta}</div>
      <div className="text-break">{children}</div>
    </div>
  )
}

function Volver() {
  return (
    <Link to="/solicitudes" className="d-inline-flex align-items-center gap-1 mb-3">
      <ArrowLeft size={16} aria-hidden="true" /> Solicitudes
    </Link>
  )
}

/** Documentos o capacitaciones que le faltan a cada persona de la solicitud. Primero, los del propio usuario. */
function Requisitos({ id, miContratistaId }: { id: string; miContratistaId: string | null }) {
  const consulta = useRequisitos(id)

  return (
    <section className="mb-4" aria-labelledby="titulo-requisitos">
      <h2 className="h6 mb-2" id="titulo-requisitos">
        Requisitos
      </h2>

      {consulta.isPending ? (
        <Cargando texto="Revisando requisitos…" />
      ) : consulta.isError ? (
        <Alert variant="warning" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span>No se pudieron cargar los requisitos.</span>
          <Button size="sm" variant="secondary" onClick={() => void consulta.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : (
        [...consulta.data]
          .sort((a, b) => Number(b.contratista_id === miContratistaId) - Number(a.contratista_id === miContratistaId))
          .map((persona) => {
            const mio = persona.contratista_id === miContratistaId
            const cumple = persona.faltantes.length === 0
            return (
              <Card key={persona.contratista_id} className="mb-2">
                <Card.Body>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <span className="fw-semibold">{persona.nombre}</span>
                    {mio && (
                      <Badge bg="secondary-subtle" text="secondary-emphasis">
                        Tú
                      </Badge>
                    )}
                  </div>

                  {cumple ? (
                    <div className="d-flex align-items-center gap-2 text-success-emphasis">
                      <CircleCheck size={18} aria-hidden="true" /> Cumple todos los requisitos
                    </div>
                  ) : (
                    <>
                      <ul className="list-unstyled mb-0">
                        {persona.faltantes.map((f, i) => (
                          <li key={`${f.tipo}-${f.referencia_id ?? i}`} className="py-1">
                            <Badge bg="warning-subtle" text="warning-emphasis" className="me-2">
                              {textoTipoRequisito(f.tipo)}
                            </Badge>
                            <span className="fw-semibold">{f.nombre}</span>
                            <div className="small">{f.motivo}</div>
                          </li>
                        ))}
                      </ul>
                      {mio && (
                        <Link to="/documentos" className="btn btn-secondary mt-2 d-inline-flex align-items-center gap-2">
                          <FileUp size={16} aria-hidden="true" /> Ir a mis documentos
                        </Link>
                      )}
                    </>
                  )}
                </Card.Body>
              </Card>
            )
          })
      )}
    </section>
  )
}

export default function SolicitudDetallePagina() {
  const { id = '' } = useParams()
  const { perfil } = useSesion()
  const solicitud = useSolicitud(id)

  if (solicitud.isPending) {
    return (
      <>
        <Volver />
        <Cargando texto="Cargando la solicitud…" />
      </>
    )
  }
  if (solicitud.isError) {
    return (
      <>
        <Volver />
        <ErrorCarga error={solicitud.error} alReintentar={() => void solicitud.refetch()} />
      </>
    )
  }

  const s = solicitud.data
  const miContratistaId = perfil?.contratista_id ?? null

  return (
    <>
      <Volver />

      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <h1 className="h4 mb-0 numeros-tabulares">{s.codigo}</h1>
        <EstadoBadge entidad="solicitud" estado={s.estado} />
      </div>
      <p className="mb-3">{s.empresas_contratistas.razon_social}</p>

      {s.estado === 'rechazada' && s.motivo_rechazo && (
        <Alert variant="danger">
          <strong>Motivo del rechazo:</strong> {s.motivo_rechazo}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Body className="pb-1">
          <Dato etiqueta="Tipo de trabajo">
            {s.tipos_trabajo.nombre}
            {s.tipos_trabajo.requiere_permiso_trabajo && (
              <Badge bg="info-subtle" text="info-emphasis" className="ms-2">
                Requiere permiso de trabajo
              </Badge>
            )}
          </Dato>
          <Dato etiqueta="Actividad">{s.descripcion_actividad}</Dato>
          <Dato etiqueta="Vigencia">
            <span className="numeros-tabulares">
              {formatearDia(s.fecha_inicio)} – {formatearDia(s.fecha_fin)}
            </span>
            <div className="small numeros-tabulares">
              Horario: {hora(s.hora_inicio)} – {hora(s.hora_fin)}
            </div>
          </Dato>

          {s.solicitud_zonas.length > 0 && (
            <Dato etiqueta="Zonas autorizadas">
              <div className="d-flex flex-wrap gap-1 pt-1">
                {s.solicitud_zonas.map(({ zonas: z }) => (
                  <Badge key={z.id} bg="body-tertiary" text="body-emphasis" className="border" title={z.nombre}>
                    {z.codigo} · {z.nombre}
                  </Badge>
                ))}
              </div>
            </Dato>
          )}

          <Dato etiqueta={`Personas (${s.solicitud_contratistas.length})`}>
            <ul className="list-unstyled mb-0">
              {s.solicitud_contratistas.map(({ contratistas: c }) => (
                <li key={c.id}>
                  {c.nombres} {c.apellidos}
                  {c.id === miContratistaId && (
                    <Badge bg="secondary-subtle" text="secondary-emphasis" className="ms-2">
                      Tú
                    </Badge>
                  )}
                  <span className="small numeros-tabulares"> · {c.documento_identidad}</span>
                </li>
              ))}
            </ul>
          </Dato>

          {s.solicitud_equipos.length > 0 && (
            <Dato etiqueta={`Equipos (${s.solicitud_equipos.length})`}>
              <ul className="list-unstyled mb-0">
                {s.solicitud_equipos.map(({ equipos: e }) => (
                  <li key={e.id}>
                    {e.nombre} <span className="small">· {e.codigo}</span>
                  </li>
                ))}
              </ul>
            </Dato>
          )}
        </Card.Body>
      </Card>

      {s.tipos_trabajo.requiere_permiso_trabajo && <PermisoDeSolicitud solicitudId={id} />}

      <Requisitos id={id} miContratistaId={miContratistaId} />
    </>
  )
}