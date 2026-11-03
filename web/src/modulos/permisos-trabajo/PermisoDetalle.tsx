import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Col, ListGroup, Modal, Row } from 'react-bootstrap'
import { Download } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import { formatearDia, formatearFechaHora } from '../../utilidades/fechas'
import { hora, puedeRevocarse, TEXTO_MOMENTO } from './ayudas'
import { usePermiso } from './permisos.api'
import type { EvidenciaPermiso } from './tipos'

interface Props {
  /** null = cerrado */
  id: string | null
  /** false mientras hay otra confirmación abierta, para no apilar dos modales */
  visible: boolean
  puedeRevocar: boolean
  alCerrar: () => void
  alRevocar: (permiso: { id: string; codigo: string }) => void
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <div className="small text-body-secondary">{etiqueta}</div>
      <div className="text-break">{children}</div>
    </div>
  )
}

export default function PermisoDetalle({ id, visible, puedeRevocar, alCerrar, alRevocar }: Props) {
  const consulta = usePermiso(id)
  const permiso = consulta.data

  const descarga = useMutation({
    mutationFn: (e: EvidenciaPermiso) => api.descargar(`/archivos/${e.archivos.id}/descargar`, e.archivos.nombre_original),
  })

  return (
    <Modal show={id !== null && visible} onHide={alCerrar} size="lg" fullscreen="sm-down" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5 d-flex flex-wrap align-items-center gap-2 mb-0">
          {permiso?.codigo ?? 'Permiso de trabajo'}
          {permiso && <EstadoBadge entidad="permiso_trabajo" estado={permiso.estado} />}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {consulta.isPending && <Cargando texto="Cargando permiso…" />}
        {consulta.isError && <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />}

        {permiso && (
          <>
            <Row className="g-3 mb-3">
              <Col xs={12} md={6}>
                <Dato etiqueta="Solicitud">
                  <Link to={`/solicitudes/${permiso.solicitud_id}`}>{permiso.solicitudes_acceso.codigo}</Link>
                  <div className="text-body">{permiso.solicitudes_acceso.descripcion_actividad}</div>
                </Dato>
              </Col>
              <Col xs={12} md={6}>
                <Dato etiqueta="Empresa">
                  {permiso.solicitudes_acceso.empresas_contratistas.razon_social}
                  <small className="text-body d-block">NIT {permiso.solicitudes_acceso.empresas_contratistas.nit}</small>
                </Dato>
              </Col>
              <Col xs={12} md={6}>
                <Dato etiqueta="Tipo de trabajo">{permiso.solicitudes_acceso.tipos_trabajo.nombre}</Dato>
              </Col>
              <Col xs={12} md={6}>
                <Dato etiqueta="Vigencia">
                  <span className="numeros-tabulares">
                    {formatearDia(permiso.fecha_inicio)} – {formatearDia(permiso.fecha_fin)}
                  </span>
                  <div className="text-body numeros-tabulares">
                    {hora(permiso.hora_inicio)} – {hora(permiso.hora_fin)}
                  </div>
                </Dato>
              </Col>
              <Col xs={12} md={6}>
                <Dato etiqueta="Emitido">
                  <span className="numeros-tabulares">{formatearFechaHora(permiso.emitido_en)}</span>
                </Dato>
              </Col>
              {permiso.actividad_inicio_en && (
                <Col xs={12} md={6}>
                  <Dato etiqueta="Actividad iniciada">
                    <span className="numeros-tabulares">{formatearFechaHora(permiso.actividad_inicio_en)}</span>
                  </Dato>
                </Col>
              )}
              <Col xs={12}>
                <Dato etiqueta="Condiciones especiales">{permiso.condiciones_especiales ?? '—'}</Dato>
              </Col>
            </Row>

            {permiso.estado === 'revocado' && (
              <Alert variant="danger" className="py-2">
                <strong>Revocado</strong>
                {permiso.revocado_en && <span className="numeros-tabulares"> · {formatearFechaHora(permiso.revocado_en)}</span>}
                <div className="text-break">{permiso.motivo_revocacion ?? '—'}</div>
              </Alert>
            )}

            <h3 className="h6">Evidencias ({permiso.evidencias_trabajo.length})</h3>
            {descarga.isError && (
              <Alert variant="danger" dismissible onClose={() => descarga.reset()} className="py-2">
                {descarga.error instanceof ErrorApi ? descarga.error.message : 'No se pudo descargar el archivo.'}
              </Alert>
            )}
            {permiso.evidencias_trabajo.length === 0 ? (
              <p className="text-body-secondary small mb-0">Sin evidencias registradas.</p>
            ) : (
              <ListGroup>
                {permiso.evidencias_trabajo.map((e) => (
                  <ListGroup.Item key={e.id} className="d-flex align-items-center justify-content-between gap-2">
                    <span className="text-break">
                      {e.archivos.nombre_original}
                      <small className="text-body d-block">
                        {TEXTO_MOMENTO[e.momento] ?? e.momento}
                        {e.descripcion ? ` · ${e.descripcion}` : ''} ·{' '}
                        <span className="numeros-tabulares">{formatearFechaHora(e.created_at)}</span>
                      </small>
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="flex-shrink-0"
                      title="Descargar"
                      aria-label={`Descargar ${e.archivos.nombre_original}`}
                      disabled={descarga.isPending}
                      onClick={() => descarga.mutate(e)}
                    >
                      <Download size={16} aria-hidden="true" />
                    </Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="flex-wrap">
        {permiso && puedeRevocar && puedeRevocarse(permiso.estado) && (
          <Button variant="outline-danger" onClick={() => alRevocar({ id: permiso.id, codigo: permiso.codigo })}>
            Revocar permiso
          </Button>
        )}
        <Button variant="secondary" onClick={alCerrar}>
          Volver
        </Button>
      </Modal.Footer>
    </Modal>
  )
}