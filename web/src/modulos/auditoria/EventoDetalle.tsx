import type { ReactNode } from 'react'
import { Button, Col, Modal, Row } from 'react-bootstrap'
import { formatearFechaHora } from '../../utilidades/fechas'
import { ENTIDADES_HISTORIAL, esUuid } from './ayudas'
import ResultadoBadge from './ResultadoBadge'
import type { EventoAuditoria } from './tipos'

interface Props {
  /** null = cerrado */
  evento: EventoAuditoria | null
  alCerrar: () => void
  alVerHistorial: (entidad: string, id: string) => void
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <div className="small text-body-secondary">{etiqueta}</div>
      <div className="text-break">{children}</div>
    </div>
  )
}

function Json({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined) return <span className="text-body-secondary">—</span>
  return (
    <pre className="bg-body-tertiary border rounded p-2 small mb-0" style={{ maxHeight: 240, overflow: 'auto' }}>
      {JSON.stringify(valor, null, 2)}
    </pre>
  )
}

export default function EventoDetalle({ evento, alCerrar, alVerHistorial }: Props) {
  // Solo algunas entidades tienen historial de estados, y se consulta por UUID
  const puedeVerHistorial = !!evento && !!evento.entidad && ENTIDADES_HISTORIAL.some((e) => e.valor === evento.entidad) && esUuid(evento.entidad_id)

  return (
    <Modal show={evento !== null} onHide={alCerrar} size="lg" fullscreen="sm-down" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5 d-flex flex-wrap align-items-center gap-2 mb-0">
          Evento de auditoría
          {evento && <ResultadoBadge resultado={evento.resultado} />}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {evento && (
          <>
            <Row className="g-3 mb-3">
              <Col xs={12} md={6}>
                <Dato etiqueta="Fecha y hora">
                  <span className="numeros-tabulares">{formatearFechaHora(evento.created_at)}</span>
                </Dato>
              </Col>
              <Col xs={12} md={6}>
                <Dato etiqueta="Usuario">{evento.usuario_email ?? 'Sin sesión'}</Dato>
              </Col>
              <Col xs={12} md={6}>
                <Dato etiqueta="Acción">
                  <span className="font-monospace">{evento.accion}</span>
                </Dato>
              </Col>
              <Col xs={12} md={6}>
                <Dato etiqueta="Entidad">{evento.entidad ?? '—'}</Dato>
              </Col>
              <Col xs={12}>
                <Dato etiqueta="Identificador">
                  <span className="font-monospace">{evento.entidad_id ?? '—'}</span>
                </Dato>
              </Col>
              <Col xs={12} md={6}>
                <Dato etiqueta="Dirección IP">{evento.ip ?? '—'}</Dato>
              </Col>
              <Col xs={12} md={6}>
                <Dato etiqueta="Navegador">
                  <small>{evento.user_agent ?? '—'}</small>
                </Dato>
              </Col>
            </Row>

            <Row className="g-3">
              <Col xs={12} md={6}>
                <div className="small text-body-secondary mb-1">Datos antes</div>
                <Json valor={evento.datos_antes} />
              </Col>
              <Col xs={12} md={6}>
                <div className="small text-body-secondary mb-1">Datos después</div>
                <Json valor={evento.datos_despues} />
              </Col>
            </Row>
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="flex-wrap">
        {puedeVerHistorial && evento?.entidad && evento.entidad_id && (
          <Button variant="secondary" onClick={() => alVerHistorial(evento.entidad as string, evento.entidad_id as string)}>
            Ver historial de estados
          </Button>
        )}
        <Button variant="primary" onClick={alCerrar}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  )
}