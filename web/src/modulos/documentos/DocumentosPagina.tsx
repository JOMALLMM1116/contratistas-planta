import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Table } from 'react-bootstrap'
import { CalendarClock, CalendarX, CircleCheck, CircleX, Download, Search } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaPaginada } from '../../api/tipos'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import Paginacion from '../../componentes/Paginacion'
import { formatearFecha, formatearFechaHora } from '../../utilidades/fechas'
import type { Documento, TipoDocumentoOpcion } from './tipos'
import { DIAS_AVISO, diasParaVencer, soloFecha } from './vencimiento'

const POR_PAGINA = 20
const RUTA = '/documentos'

type Decision = 'aprobado' | 'rechazado'

const textoError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null

/** Dueño del documento: contratista, empresa o equipo (el backend garantiza solo uno) */
function titularDe(d: Documento) {
  if (d.contratistas) {
    return { tipo: 'Contratista', nombre: `${d.contratistas.nombres} ${d.contratistas.apellidos}`, detalle: d.contratistas.documento_identidad }
  }
  if (d.empresas_contratistas) {
    return { tipo: 'Empresa', nombre: d.empresas_contratistas.razon_social, detalle: `NIT ${d.empresas_contratistas.nit}` }
  }
  if (d.equipos) {
    return { tipo: 'Equipo', nombre: d.equipos.nombre, detalle: d.equipos.codigo }
  }
  return { tipo: '—', nombre: '—', detalle: '' }
}

/** Fecha de vencimiento con aviso. Es solo visual: la validez la decide el backend. */
function Vencimiento({ fecha }: { fecha: string | null }) {
  const dias = diasParaVencer(fecha)
  if (dias === null) return <span className="text-body-secondary">Sin vencimiento</span>

  const vencido = dias < 0
  const aviso = !vencido && dias <= DIAS_AVISO
  const texto = dias === 0 ? 'Vence hoy' : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`

  return (
    <div>
      <div className="numeros-tabulares">{formatearFecha(soloFecha(fecha))}</div>
      {(vencido || aviso) && (
        <Badge
          bg={vencido ? 'danger-subtle' : 'warning-subtle'}
          text={vencido ? 'danger-emphasis' : 'warning-emphasis'}
          className="d-inline-flex align-items-center gap-1 fw-semibold mt-1"
        >
          {vencido ? <CalendarX size={13} aria-hidden="true" /> : <CalendarClock size={13} aria-hidden="true" />}
          {vencido ? 'Vencido' : texto}
        </Badge>
      )}
    </div>
  )
}

/** Estado de la revisión, con el motivo y la fecha si ya se revisó */
function EstadoRevision({ documento }: { documento: Documento }) {
  return (
    <>
      <EstadoBadge entidad="revision" estado={documento.estado_revision} />
      {documento.observaciones && <div className="small text-body-secondary mt-1 text-break">{documento.observaciones}</div>}
      {documento.revisado_en && <div className="small text-body-secondary numeros-tabulares">{formatearFechaHora(documento.revisado_en)}</div>}
    </>
  )
}

interface PropsAcciones {
  documento: Documento
  /** true en celular y tablet: botones con texto, más fáciles de tocar */
  conTexto?: boolean
  descargando: boolean
  alDescargar: () => void
  alRevisar: (decision: Decision) => void
}

/** Descargar siempre; aprobar y rechazar solo si está pendiente */
function AccionesDocumento({ documento, conTexto, descargando, alDescargar, alRevisar }: PropsAcciones) {
  const titular = titularDe(documento)
  const pendiente = documento.estado_revision === 'pendiente'
  const base = conTexto ? 'd-inline-flex align-items-center gap-1' : ''

  return (
    <div className={conTexto ? 'd-flex flex-wrap gap-2' : 'd-inline-flex gap-1'}>
      <Button
        variant="outline-secondary"
        size="sm"
        className={base}
        title="Descargar archivo"
        aria-label={`Descargar ${documento.archivos.nombre_original}`}
        disabled={descargando}
        onClick={alDescargar}
      >
        <Download size={16} aria-hidden="true" />
        {conTexto && 'Descargar'}
      </Button>
      {pendiente && (
        <>
          <Button
            variant="outline-success"
            size="sm"
            className={base}
            title="Aprobar"
            aria-label={`Aprobar ${documento.tipos_documento.nombre} de ${titular.nombre}`}
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
            aria-label={`Rechazar ${documento.tipos_documento.nombre} de ${titular.nombre}`}
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

function MensajeRevision({ documento, decision }: { documento: Documento; decision: Decision }) {
  const titular = titularDe(documento)
  const dias = diasParaVencer(documento.fecha_vencimiento)
  const detalle = (
    <>
      <strong>{documento.tipos_documento.nombre}</strong>
      {documento.numero ? ` (N.º ${documento.numero})` : ''} de <strong>{titular.nombre}</strong>
    </>
  )

  if (decision === 'rechazado') {
    return <>Se rechazará {detalle}. Un documento rechazado no puede volver a revisarse: habrá que presentar uno nuevo.</>
  }

  return (
    <>
      Se aprobará {detalle}. Podrá usarse para cumplir los requisitos de las solicitudes de acceso mientras esté vigente.
      {dias !== null && dias < 0 && (
        <Alert variant="warning" className="py-2 mt-3 mb-0">
          Este documento ya está vencido: aunque se apruebe, no cuenta como requisito vigente.
        </Alert>
      )}
    </>
  )
}

export default function DocumentosPagina() {
  const queryClient = useQueryClient()

  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [revision, setRevision] = useState<{ documento: Documento; decision: Decision } | null>(null)

  // Espera a que se deje de escribir antes de consultar
  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscar(busqueda.trim())
      setPagina(1)
    }, 400)
    return () => clearTimeout(espera)
  }, [busqueda])

  const tipos = useQuery({
    queryKey: ['tipos-documento-selector'],
    queryFn: () => api.get<RespuestaPaginada<TipoDocumentoOpcion>>('/tipos-documento', { por_pagina: 100, ordenar_por: 'nombre' }),
    staleTime: 5 * 60_000,
  })

  const consulta = useQuery({
    queryKey: ['documentos', { pagina, buscar, estado, tipoId, vencimiento }],
    queryFn: () =>
      api.get<RespuestaPaginada<Documento>>(RUTA, {
        pagina,
        por_pagina: POR_PAGINA,
        buscar,
        estado_revision: estado,
        tipo_documento_id: tipoId,
        vencidos: vencimiento === 'vencidos' ? true : undefined,
        por_vencer: vencimiento === 'por_vencer' ? DIAS_AVISO : undefined,
        // Con filtro de vencimiento, lo más urgente primero
        ordenar_por: vencimiento ? 'fecha_vencimiento' : 'created_at',
        orden: vencimiento ? 'asc' : 'desc',
      }),
    placeholderData: keepPreviousData,
  })

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['documentos'] })

  const revisar = useMutation({
    mutationFn: ({ id, decision, observaciones }: { id: string; decision: Decision; observaciones?: string }) =>
      api.post(`${RUTA}/${id}/revision`, { decision, observaciones }),
    onSuccess: () => {
      setRevision(null)
      void refrescar()
    },
    // 409: alguien más ya revisó el documento; se recarga la lista para que se vea el estado real
    onError: (error) => {
      if (error instanceof ErrorApi && error.status === 409) void refrescar()
    },
  })

  const descarga = useMutation({
    mutationFn: (d: Documento) => api.descargar(`/archivos/${d.archivos.id}/descargar`, d.archivos.nombre_original),
  })

  function abrirRevision(documento: Documento, decision: Decision) {
    revisar.reset()
    setRevision({ documento, decision })
  }

  function limpiarFiltros() {
    setBusqueda('')
    setBuscar('')
    setEstado('')
    setTipoId('')
    setVencimiento('')
    setPagina(1)
  }

  const documentos = consulta.data?.datos ?? []
  const hayFiltros = buscar !== '' || estado !== '' || tipoId !== '' || vencimiento !== ''

  return (
    <>
      <EncabezadoPagina
        titulo="Documentos"
        descripcion="Revisión de los documentos que presentan contratistas, empresas y equipos."
      />

      <Row className="g-2 mb-3 align-items-end">
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-numero">
            <Form.Label>Número de documento</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <Search size={16} aria-hidden="true" />
              </InputGroup.Text>
              <Form.Control type="search" placeholder="Buscar por número" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </InputGroup>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-tipo">
            <Form.Label>Tipo de documento</Form.Label>
            <Form.Select
              value={tipoId}
              onChange={(e) => {
                setTipoId(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos los tipos</option>
              {(tipos.data?.datos ?? []).map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
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
              <option value="aprobado">Aprobados</option>
              <option value="rechazado">Rechazados</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-vencimiento">
            <Form.Label>Vencimiento</Form.Label>
            <Form.Select
              value={vencimiento}
              onChange={(e) => {
                setVencimiento(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos</option>
              <option value="vencidos">Vencidos</option>
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
          <Cargando texto="Cargando documentos…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : documentos.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'No hay documentos con esos filtros' : 'Aún no hay documentos registrados'}
            descripcion={hayFiltros ? 'Prueba con otros filtros.' : 'Los documentos aparecen cuando los presentan contratistas o empresas.'}
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
                <th>Documento</th>
                <th className="d-none d-lg-table-cell">Titular</th>
                <th className="d-none d-lg-table-cell">Vencimiento</th>
                <th className="d-none d-lg-table-cell">Estado</th>
                <th className="d-none d-lg-table-cell text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => {
                const titular = titularDe(d)
                const alDescargar = () => descarga.mutate(d)
                const alRevisar = (decision: Decision) => abrirRevision(d, decision)
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="fw-semibold">{d.tipos_documento.nombre}</div>
                      <small className="text-body-secondary numeros-tabulares">{d.numero ? `N.º ${d.numero}` : 'Sin número'}</small>

                      {/* Celular y tablet: todo apilado bajo el nombre */}
                      <div className="d-lg-none mt-2 d-flex flex-column gap-2">
                        <div>
                          <div>{titular.nombre}</div>
                          <small className="text-body-secondary">
                            {titular.tipo}
                            {titular.detalle ? ` · ${titular.detalle}` : ''}
                          </small>
                        </div>
                        <Vencimiento fecha={d.fecha_vencimiento} />
                        <div>
                          <EstadoRevision documento={d} />
                        </div>
                        <AccionesDocumento
                          documento={d}
                          conTexto
                          descargando={descarga.isPending}
                          alDescargar={alDescargar}
                          alRevisar={alRevisar}
                        />
                      </div>
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <div>{titular.nombre}</div>
                      <small className="text-body-secondary">
                        {titular.tipo}
                        {titular.detalle ? ` · ${titular.detalle}` : ''}
                      </small>
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <Vencimiento fecha={d.fecha_vencimiento} />
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <div style={{ maxWidth: 220 }}>
                        <EstadoRevision documento={d} />
                      </div>
                    </td>
                    <td className="d-none d-lg-table-cell text-end">
                      <AccionesDocumento documento={d} descargando={descarga.isPending} alDescargar={alDescargar} alRevisar={alRevisar} />
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
        titulo={revision?.decision === 'rechazado' ? 'Rechazar documento' : 'Aprobar documento'}
        mensaje={revision ? <MensajeRevision documento={revision.documento} decision={revision.decision} /> : null}
        textoConfirmar={revision?.decision === 'rechazado' ? 'Rechazar' : 'Aprobar'}
        variante={revision?.decision === 'rechazado' ? 'danger' : 'success'}
        pedirMotivo={revision?.decision === 'rechazado'}
        etiquetaMotivo="Observaciones (motivo del rechazo)"
        procesando={revisar.isPending}
        error={textoError(revisar.error)}
        alConfirmar={(motivo) =>
          revision &&
          revisar.mutate({
            id: revision.documento.id,
            decision: revision.decision,
            observaciones: revision.decision === 'rechazado' ? motivo : undefined,
          })
        }
        alCancelar={() => setRevision(null)}
      />
    </>
  )
}