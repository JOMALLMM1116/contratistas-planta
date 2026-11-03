import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { CalendarClock, CalendarX, CircleCheck, CircleX, Download } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaPaginada } from '../../api/tipos'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import Paginacion from '../../componentes/Paginacion'
import { formatearFecha, formatearFechaHora } from '../../utilidades/fechas'
import { DIAS_AVISO, diasParaVencer, soloFecha } from '../../utilidades/vencimiento'
import type { CapacitacionOpcion, RegistroCapacitacion } from './tipos'

const POR_PAGINA = 20
const RUTA = '/contratista-capacitaciones'

type Decision = 'aprobado' | 'rechazado'

const textoError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null

const nombreDe = (r: RegistroCapacitacion) => `${r.contratistas.nombres} ${r.contratistas.apellidos}`

/** Fecha de vencimiento con aviso. Es solo visual: la validez la decide el backend. */
function Vencimiento({ fecha }: { fecha: string | null }) {
  const dias = diasParaVencer(fecha)
  if (dias === null) return <span className="text-body-secondary">No vence</span>

  const vencida = dias < 0
  const aviso = !vencida && dias <= DIAS_AVISO
  const texto = dias === 0 ? 'Vence hoy' : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`

  return (
    <div>
      <div className="numeros-tabulares">{formatearFecha(soloFecha(fecha))}</div>
      {(vencida || aviso) && (
        <Badge
          bg={vencida ? 'danger-subtle' : 'warning-subtle'}
          text={vencida ? 'danger-emphasis' : 'warning-emphasis'}
          className="d-inline-flex align-items-center gap-1 fw-semibold mt-1"
        >
          {vencida ? <CalendarX size={13} aria-hidden="true" /> : <CalendarClock size={13} aria-hidden="true" />}
          {vencida ? 'Vencida' : texto}
        </Badge>
      )}
    </div>
  )
}

/** Estado de la revisión y, si ya se revisó, cuándo. El motivo del rechazo queda en el historial. */
function EstadoRevision({ registro }: { registro: RegistroCapacitacion }) {
  return (
    <>
      <EstadoBadge entidad="revision" estado={registro.estado_revision} />
      {registro.revisado_en && <div className="small text-body-secondary numeros-tabulares mt-1">{formatearFechaHora(registro.revisado_en)}</div>}
    </>
  )
}

interface PropsAcciones {
  registro: RegistroCapacitacion
  /** true en celular y tablet: botones con texto, más fáciles de tocar */
  conTexto?: boolean
  descargando: boolean
  alDescargar: () => void
  alRevisar: (decision: Decision) => void
}

/** Descargar (si hay archivo); aprobar y rechazar solo si está pendiente */
function AccionesRegistro({ registro, conTexto, descargando, alDescargar, alRevisar }: PropsAcciones) {
  const pendiente = registro.estado_revision === 'pendiente'
  const base = conTexto ? 'd-inline-flex align-items-center gap-1' : ''
  const descripcion = `${registro.capacitaciones.nombre} de ${nombreDe(registro)}`

  return (
    <div className={conTexto ? 'd-flex flex-wrap gap-2' : 'd-inline-flex gap-1'}>
      {registro.archivos && (
        <Button
          variant="outline-secondary"
          size="sm"
          className={base}
          title="Descargar constancia"
          aria-label={`Descargar ${registro.archivos.nombre_original}`}
          disabled={descargando}
          onClick={alDescargar}
        >
          <Download size={16} aria-hidden="true" />
          {conTexto && 'Constancia'}
        </Button>
      )}
      {pendiente && (
        <>
          <Button
            variant="outline-success"
            size="sm"
            className={base}
            title="Aprobar"
            aria-label={`Aprobar ${descripcion}`}
            onClick={() => alRevisar('aprobado')}
          >
            <CircleCheck size={16} aria-hidden="true" />
            {conTexto && 'Aprobar'}
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            className={base}
            title="Rechazar"
            aria-label={`Rechazar ${descripcion}`}
            onClick={() => alRevisar('rechazado')}
          >
            <CircleX size={16} aria-hidden="true" />
            {conTexto && 'Rechazar'}
          </Button>
        </>
      )}
    </div>
  )
}

function MensajeRevision({ registro, decision }: { registro: RegistroCapacitacion; decision: Decision }) {
  const dias = diasParaVencer(registro.fecha_vencimiento)
  const detalle = (
    <>
      la capacitación <strong>{registro.capacitaciones.nombre}</strong> de <strong>{nombreDe(registro)}</strong>
    </>
  )

  if (decision === 'rechazado') {
    return (
      <>
        Se rechazará {detalle}. No podrá volver a revisarse: habrá que registrar una nueva. El motivo queda en el historial de estados.
      </>
    )
  }

  return (
    <>
      Se aprobará {detalle}. Contará para los requisitos de las solicitudes de acceso mientras esté vigente.
      {dias !== null && dias < 0 && (
        <Alert variant="warning" className="py-2 mt-3 mb-0">
          Esta capacitación ya está vencida: aunque se apruebe, no cuenta como requisito vigente.
        </Alert>
      )}
    </>
  )
}

export default function CapacitacionesPagina() {
  const queryClient = useQueryClient()

  const [pagina, setPagina] = useState(1)
  const [capacitacionId, setCapacitacionId] = useState('')
  const [estado, setEstado] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [revision, setRevision] = useState<{ registro: RegistroCapacitacion; decision: Decision } | null>(null)

  const capacitaciones = useQuery({
    queryKey: ['capacitaciones-selector'],
    queryFn: () => api.get<RespuestaPaginada<CapacitacionOpcion>>('/capacitaciones', { por_pagina: 100, ordenar_por: 'nombre' }),
    staleTime: 5 * 60_000,
  })

  const consulta = useQuery({
    queryKey: ['contratista-capacitaciones', { pagina, capacitacionId, estado, vencimiento }],
    queryFn: () =>
      api.get<RespuestaPaginada<RegistroCapacitacion>>(RUTA, {
        pagina,
        por_pagina: POR_PAGINA,
        capacitacion_id: capacitacionId,
        estado_revision: estado,
        vencidos: vencimiento === 'vencidas' ? true : undefined,
        por_vencer: vencimiento === 'por_vencer' ? DIAS_AVISO : undefined,
        // Con filtro de vencimiento, lo más urgente primero
        ordenar_por: vencimiento ? 'fecha_vencimiento' : 'created_at',
        orden: vencimiento ? 'asc' : 'desc',
      }),
    placeholderData: keepPreviousData,
  })

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['contratista-capacitaciones'] })

  const revisar = useMutation({
    mutationFn: ({ id, decision, motivo }: { id: string; decision: Decision; motivo?: string }) =>
      api.post(`${RUTA}/${id}/revision`, { decision, motivo }),
    onSuccess: () => {
      setRevision(null)
      void refrescar()
    },
    // 409: alguien más ya revisó el registro; se recarga la lista para que se vea el estado real
    onError: (error) => {
      if (error instanceof ErrorApi && error.status === 409) void refrescar()
    },
  })

  const descarga = useMutation({
    mutationFn: async (r: RegistroCapacitacion) => {
      if (r.archivos) await api.descargar(`/archivos/${r.archivos.id}/descargar`, r.archivos.nombre_original)
    },
  })

  function abrirRevision(registro: RegistroCapacitacion, decision: Decision) {
    revisar.reset()
    setRevision({ registro, decision })
  }

  function limpiarFiltros() {
    setCapacitacionId('')
    setEstado('')
    setVencimiento('')
    setPagina(1)
  }

  const registros = consulta.data?.datos ?? []
  const hayFiltros = capacitacionId !== '' || estado !== '' || vencimiento !== ''

  return (
    <>
      <EncabezadoPagina
        titulo="Capacitaciones"
        descripcion="Revisión de las capacitaciones y certificaciones que presentan los contratistas."
      />

      <Row className="g-2 mb-3 align-items-end">
        <Col xs={12} md={4}>
          <Form.Group controlId="filtro-capacitacion">
            <Form.Label>Capacitación</Form.Label>
            <Form.Select
              value={capacitacionId}
              onChange={(e) => {
                setCapacitacionId(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todas las capacitaciones</option>
              {(capacitaciones.data?.datos ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={4}>
          <Form.Group controlId="filtro-estado">
            <Form.Label>Estado de revisión</Form.Label>
            <Form.Select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes de revisión</option>
              <option value="aprobado">Aprobadas</option>
              <option value="rechazado">Rechazadas</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={4}>
          <Form.Group controlId="filtro-vencimiento">
            <Form.Label>Vencimiento</Form.Label>
            <Form.Select
              value={vencimiento}
              onChange={(e) => {
                setVencimiento(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todas</option>
              <option value="vencidas">Vencidas</option>
              <option value="por_vencer">Vencen en {DIAS_AVISO} días</option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      {descarga.isError && (
        <Alert variant="danger" dismissible onClose={() => descarga.reset()}>
          {textoError(descarga.error)}
        </Alert>
      )}

      <Card>
        {consulta.isPending ? (
          <Cargando texto="Cargando capacitaciones…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : registros.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'No hay capacitaciones con esos filtros' : 'Aún no hay capacitaciones registradas'}
            descripcion={hayFiltros ? 'Prueba con otros filtros.' : 'Aparecen cuando los contratistas presentan sus constancias.'}
            accion={
              hayFiltros ? (
                <Button size="sm" variant="outline-primary" onClick={limpiarFiltros}>
                  Quitar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table responsive hover className="align-middle mb-0">
            {/* Debajo de 992 px todo va apilado dentro de la primera celda (sin scroll lateral);
                desde 992 px se muestra la tabla completa */}
            <thead>
              <tr>
                <th>Capacitación</th>
                <th className="d-none d-lg-table-cell">Contratista</th>
                <th className="d-none d-lg-table-cell">Realizada</th>
                <th className="d-none d-lg-table-cell">Vencimiento</th>
                <th className="d-none d-lg-table-cell">Estado</th>
                <th className="d-none d-lg-table-cell text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => {
                const alDescargar = () => descarga.mutate(r)
                const alRevisar = (decision: Decision) => abrirRevision(r, decision)
                return (
                  <tr key={r.id}>
                    <td>
                      {/* Celular: todo apilado. Tablet (md): datos a la izquierda; estado y acciones a la derecha.
                          Escritorio (lg): solo el nombre, el resto va en sus columnas */}
                      <Row className="g-2">
                        <Col xs={12} md={6} lg={12}>
                          <div className="fw-semibold">{r.capacitaciones.nombre}</div>
                          <small className="text-body-secondary">{r.capacitaciones.codigo}</small>

                          <div className="d-lg-none mt-2 d-flex flex-column gap-2">
                            <div>
                              <div>{nombreDe(r)}</div>
                              <small className="text-body-secondary numeros-tabulares">{r.contratistas.documento_identidad}</small>
                            </div>
                            <small className="text-body-secondary numeros-tabulares">Realizada el {formatearFecha(soloFecha(r.fecha_realizacion))}</small>
                            <Vencimiento fecha={r.fecha_vencimiento} />
                          </div>
                        </Col>
                        <Col xs={12} md={6} className="d-lg-none d-flex flex-column gap-2">
                          <div>
                            <EstadoRevision registro={r} />
                          </div>
                          <AccionesRegistro registro={r} conTexto descargando={descarga.isPending} alDescargar={alDescargar} alRevisar={alRevisar} />
                        </Col>
                      </Row>
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <div>{nombreDe(r)}</div>
                      <small className="text-body-secondary numeros-tabulares">{r.contratistas.documento_identidad}</small>
                    </td>
                    <td className="d-none d-lg-table-cell numeros-tabulares">{formatearFecha(soloFecha(r.fecha_realizacion))}</td>
                    <td className="d-none d-lg-table-cell">
                      <Vencimiento fecha={r.fecha_vencimiento} />
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <EstadoRevision registro={r} />
                    </td>
                    <td className="d-none d-lg-table-cell text-end">
                      <AccionesRegistro registro={r} descargando={descarga.isPending} alDescargar={alDescargar} alRevisar={alRevisar} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {consulta.data && <Paginacion meta={consulta.data.meta} alCambiar={setPagina} deshabilitado={consulta.isPlaceholderData} />}

      <ConfirmarAccion
        mostrar={revision !== null}
        titulo={revision?.decision === 'rechazado' ? 'Rechazar capacitación' : 'Aprobar capacitación'}
        mensaje={revision ? <MensajeRevision registro={revision.registro} decision={revision.decision} /> : null}
        textoConfirmar={revision?.decision === 'rechazado' ? 'Rechazar' : 'Aprobar'}
        variante={revision?.decision === 'rechazado' ? 'danger' : 'success'}
        pedirMotivo={revision?.decision === 'rechazado'}
        etiquetaMotivo="Motivo del rechazo"
        procesando={revisar.isPending}
        error={textoError(revisar.error)}
        alConfirmar={(motivo) =>
          revision &&
          revisar.mutate({
            id: revision.registro.id,
            decision: revision.decision,
            motivo: revision.decision === 'rechazado' ? motivo : undefined,
          })
        }
        alCancelar={() => setRevision(null)}
      />
    </>
  )
}