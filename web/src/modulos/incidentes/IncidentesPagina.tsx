import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { Plus } from 'lucide-react'
import { api } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import Paginacion from '../../componentes/Paginacion'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { formatearFechaHora } from '../../utilidades/fechas'
import { afectadosDe } from './ayudas'
import IncidenteDetalle from './IncidenteDetalle'
import IncidenteFormulario from './IncidenteFormulario'
import SeveridadBadge from './SeveridadBadge'
import type { DatosIncidente, Incidente } from './tipos'

const POR_PAGINA = 20
const RUTA = '/incidentes'

export default function IncidentesPagina() {
  const queryClient = useQueryClient()
  const { perfil } = useSesion()
  // Consultar y gestionar exige incidentes.gestionar; reportar es un permiso distinto
  const puedeGestionar = tienePermiso(perfil, 'incidentes.gestionar')
  const puedeReportar = tienePermiso(perfil, 'incidentes.reportar')

  const [pagina, setPagina] = useState(1)
  const [estado, setEstado] = useState('')
  const [severidad, setSeveridad] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [reportado, setReportado] = useState<string | null>(null)

  const rangoInvalido = desde !== '' && hasta !== '' && hasta < desde

  const consulta = useQuery({
    queryKey: ['incidentes', { pagina, estado, severidad, desde, hasta }],
    queryFn: () =>
      api.get<RespuestaPaginada<Incidente>>(RUTA, {
        pagina,
        por_pagina: POR_PAGINA,
        estado,
        severidad,
        desde,
        hasta,
        ordenar_por: 'fecha_ocurrencia',
        orden: 'desc',
      }),
    enabled: puedeGestionar && !rangoInvalido,
    placeholderData: keepPreviousData,
  })

  const crear = useMutation({
    mutationFn: (datos: DatosIncidente) => api.post<RespuestaDatos<Incidente>>(RUTA, datos),
    onSuccess: (respuesta) => {
      setMostrarFormulario(false)
      setReportado(respuesta.datos.codigo)
      void queryClient.invalidateQueries({ queryKey: ['incidentes'] })
    },
  })

  function abrirFormulario() {
    crear.reset()
    setMostrarFormulario(true)
  }

  const botonReportar = puedeReportar ? (
    <Button className="d-inline-flex align-items-center gap-1" onClick={abrirFormulario}>
      <Plus size={16} aria-hidden="true" /> {puedeGestionar ? 'Nuevo incidente' : 'Reportar incidente'}
    </Button>
  ) : undefined

  const formulario = (
    <IncidenteFormulario
      mostrar={mostrarFormulario}
      procesando={crear.isPending}
      error={crear.error}
      alGuardar={(datos) => crear.mutate(datos)}
      alCancelar={() => setMostrarFormulario(false)}
    />
  )

  const avisoReportado = reportado && (
    <Alert variant="success" dismissible onClose={() => setReportado(null)}>
      Incidente <strong>{reportado}</strong> reportado correctamente.
    </Alert>
  )

  // Quien solo puede reportar (garita, supervisor de campo): el backend no le deja consultar la lista
  if (!puedeGestionar) {
    return (
      <>
        <EncabezadoPagina titulo="Incidentes" descripcion="Reporta un incidente ocurrido en la planta." acciones={botonReportar} />
        {avisoReportado}
        <Card body className="text-center py-5">
          <p className="mb-1 fw-semibold">Reporta lo ocurrido con el botón «Reportar incidente».</p>
          <p className="text-body-secondary mb-0">La consulta y el seguimiento de los incidentes los hace seguridad industrial.</p>
        </Card>
        {formulario}
      </>
    )
  }

  const incidentes = consulta.data?.datos ?? []
  const hayFiltros = estado !== '' || severidad !== '' || desde !== '' || hasta !== ''

  function limpiarFiltros() {
    setEstado('')
    setSeveridad('')
    setDesde('')
    setHasta('')
    setPagina(1)
  }

  return (
    <>
      <EncabezadoPagina titulo="Incidentes" descripcion="Incidentes de seguridad ocurridos en la planta y su seguimiento." acciones={botonReportar} />
      {avisoReportado}

      <Row className="g-2 mb-3 align-items-end">
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-estado">
            <Form.Label>Estado</Form.Label>
            <Form.Select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos los estados</option>
              <option value="abierto">Abiertos</option>
              <option value="en_investigacion">En investigación</option>
              <option value="cerrado">Cerrados</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-severidad">
            <Form.Label>Severidad</Form.Label>
            <Form.Select
              value={severidad}
              onChange={(e) => {
                setSeveridad(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todas las severidades</option>
              <option value="leve">Leve</option>
              <option value="moderado">Moderado</option>
              <option value="grave">Grave</option>
              <option value="critico">Crítico</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-desde">
            <Form.Label>Desde</Form.Label>
            <Form.Control
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value)
                setPagina(1)
              }}
            />
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-hasta">
            <Form.Label>Hasta</Form.Label>
            <Form.Control
              type="date"
              value={hasta}
              isInvalid={rangoInvalido}
              onChange={(e) => {
                setHasta(e.target.value)
                setPagina(1)
              }}
            />
            <Form.Control.Feedback type="invalid">La fecha final no puede ser anterior a la inicial.</Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>

      <Card>
        {rangoInvalido ? (
          <SinDatos titulo="Revisa el rango de fechas" descripcion="La fecha final no puede ser anterior a la inicial." />
        ) : consulta.isPending ? (
          <Cargando texto="Cargando incidentes…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : incidentes.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'No hay incidentes con esos filtros' : 'No hay incidentes registrados'}
            descripcion={hayFiltros ? 'Prueba con otros filtros.' : 'Cuando se reporte uno, aparecerá aquí.'}
            accion={
              hayFiltros ? (
                <Button size="sm" variant="outline-secondary" onClick={limpiarFiltros}>
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
                <th>Incidente</th>
                <th className="d-none d-lg-table-cell">Afecta a</th>
                <th className="d-none d-lg-table-cell">Ocurrió</th>
                <th className="d-none d-lg-table-cell">Estado</th>
                <th className="d-none d-lg-table-cell text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {incidentes.map((i) => {
                const afectados = afectadosDe(i)
                return (
                  <tr key={i.id}>
                    <td>
                      <div className="fw-semibold numeros-tabulares">{i.codigo}</div>
                      <div className="d-none d-lg-block text-body-secondary text-truncate" style={{ maxWidth: 320 }}>
                        {i.descripcion}
                      </div>
                      <div className="d-none d-lg-block mt-1">
                        <SeveridadBadge severidad={i.severidad} />
                      </div>

                      {/* Celular y tablet: todo apilado bajo el código (dos columnas en tablet) */}
                      <div className="d-lg-none mt-1">
                        <div className="text-break mb-2">{i.descripcion}</div>
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                            {afectados.map((a) => (
                              <div key={a.tipo}>
                                {a.nombre}
                                <small className="text-body-secondary d-block">
                                  {a.tipo}
                                  {a.detalle ? ` · ${a.detalle}` : ''}
                                </small>
                              </div>
                            ))}
                            <small className="text-body-secondary numeros-tabulares">{formatearFechaHora(i.fecha_ocurrencia)}</small>
                          </Col>
                          <Col xs={12} md={6}>
                            <div className="d-flex flex-wrap gap-2 mb-2">
                              <EstadoBadge entidad="incidente" estado={i.estado} />
                              <SeveridadBadge severidad={i.severidad} />
                            </div>
                            <Button size="sm" variant="primary" onClick={() => setDetalleId(i.id)}>
                              Ver detalle
                            </Button>
                          </Col>
                        </Row>
                      </div>
                    </td>
                    <td className="d-none d-lg-table-cell">
                      {afectados.map((a) => (
                        <div key={a.tipo}>
                          {a.nombre}
                          <small className="text-body-secondary d-block">
                            {a.tipo}
                            {a.detalle ? ` · ${a.detalle}` : ''}
                          </small>
                        </div>
                      ))}
                    </td>
                    <td className="d-none d-lg-table-cell numeros-tabulares">{formatearFechaHora(i.fecha_ocurrencia)}</td>
                    <td className="d-none d-lg-table-cell">
                      <EstadoBadge entidad="incidente" estado={i.estado} />
                    </td>
                    <td className="d-none d-lg-table-cell text-end">
                      <Button size="sm" variant="primary" aria-label={`Ver detalle de ${i.codigo}`} onClick={() => setDetalleId(i.id)}>
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {consulta.data && !rangoInvalido && <Paginacion meta={consulta.data.meta} alCambiar={setPagina} deshabilitado={consulta.isPlaceholderData} />}

      {formulario}
      <IncidenteDetalle id={detalleId} alCerrar={() => setDetalleId(null)} />
    </>
  )
}