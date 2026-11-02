import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Form, ListGroup, Row } from 'react-bootstrap'
import { Search } from 'lucide-react'
import { api } from '../../api/cliente'
import type { RespuestaDatos } from '../../api/tipos'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import { formatearFechaHora } from '../../utilidades/fechas'
import { ENTIDADES_HISTORIAL, esUuid } from './ayudas'
import type { CambioEstado } from './tipos'

interface Props {
  /** Consulta que llega desde el detalle de un evento (null = ninguna) */
  inicial: { entidad: string; id: string } | null
}

export default function HistorialPestana({ inicial }: Props) {
  const [entidad, setEntidad] = useState('solicitud')
  const [idTexto, setIdTexto] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [consultado, setConsultado] = useState<{ entidad: string; id: string } | null>(null)

  // Si llega desde un evento, se rellena y se consulta de una vez
  useEffect(() => {
    if (!inicial) return
    setEntidad(inicial.entidad)
    setIdTexto(inicial.id)
    setIntentado(false)
    setConsultado(inicial)
  }, [inicial])

  const idLimpio = idTexto.trim()
  const errorId = intentado && !esUuid(idLimpio) ? 'Escribe un identificador válido (formato UUID).' : undefined

  const consulta = useQuery({
    queryKey: ['auditoria-historial', consultado],
    queryFn: () => api.get<RespuestaDatos<CambioEstado[]>>('/auditoria/historial', { entidad: consultado?.entidad, entidad_id: consultado?.id }),
    enabled: consultado !== null,
  })

  function buscar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (!esUuid(idLimpio)) return
    setConsultado({ entidad, id: idLimpio })
  }

  const estados = ENTIDADES_HISTORIAL.find((e) => e.valor === consultado?.entidad)?.estados ?? 'solicitud'
  const cambios = consulta.data?.datos ?? []

  return (
    <>
      <Form onSubmit={buscar} noValidate>
        <Row className="g-2 mb-3 align-items-start">
          <Col xs={12} md={4}>
            <Form.Group controlId="hist-entidad">
              <Form.Label>Tipo de registro</Form.Label>
              <Form.Select value={entidad} onChange={(e) => setEntidad(e.target.value)}>
                {ENTIDADES_HISTORIAL.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.texto}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col xs={12} md={5}>
            <Form.Group controlId="hist-id">
              <Form.Label>Identificador</Form.Label>
              <Form.Control
                className="font-monospace"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={idTexto}
                onChange={(e) => setIdTexto(e.target.value)}
                isInvalid={!!errorId}
              />
              <Form.Control.Feedback type="invalid">{errorId}</Form.Control.Feedback>
              <Form.Text className="text-body-secondary">Cópialo desde el detalle de un evento.</Form.Text>
            </Form.Group>
          </Col>
          <Col xs={12} md={3} className="d-grid align-self-md-end">
            <Button type="submit" variant="primary" className="d-inline-flex align-items-center justify-content-center gap-1">
              <Search size={16} aria-hidden="true" /> Buscar
            </Button>
          </Col>
        </Row>
      </Form>

      <Card>
        {consultado === null ? (
          <SinDatos titulo="Consulta el historial de un registro" descripcion="Elige el tipo de registro y escribe su identificador, o llega desde el detalle de un evento." />
        ) : consulta.isPending ? (
          <Cargando texto="Cargando historial…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : cambios.length === 0 ? (
          <SinDatos titulo="Sin cambios de estado" descripcion="Este registro no tiene cambios de estado registrados." />
        ) : (
          <ListGroup variant="flush">
            {cambios.map((c) => (
              <ListGroup.Item key={c.id}>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  {c.estado_anterior ? <EstadoBadge entidad={estados} estado={c.estado_anterior} /> : <span className="text-body-secondary small">Inicio</span>}
                  <span aria-hidden="true">→</span>
                  <EstadoBadge entidad={estados} estado={c.estado_nuevo} />
                </div>
                {c.motivo && <div className="mt-1 text-break">{c.motivo}</div>}
                <small className="text-body-secondary d-block mt-1">
                  <span className="numeros-tabulares">{formatearFechaHora(c.created_at)}</span> ·{' '}
                  {c.usuario ? `${c.usuario.nombre_completo} (${c.usuario.email})` : 'Proceso automático'}
                </small>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card>
    </>
  )
}