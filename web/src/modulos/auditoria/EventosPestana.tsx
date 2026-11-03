import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Form, InputGroup, Row, Table } from 'react-bootstrap'
import { Search } from 'lucide-react'
import { api } from '../../api/cliente'
import type { RespuestaPaginada } from '../../api/tipos'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import Paginacion from '../../componentes/Paginacion'
import { formatearFechaHora } from '../../utilidades/fechas'
import { ACCIONES_AUDITORIA, ENTIDADES_AUDITORIA } from './ayudas'
import EventoDetalle from './EventoDetalle'
import ResultadoBadge from './ResultadoBadge'
import type { EventoAuditoria } from './tipos'

const POR_PAGINA = 20

/** Devuelve el valor solo cuando se deja de escribir */
function useRetardo(valor: string, ms = 400) {
  const [retardado, setRetardado] = useState(valor)
  useEffect(() => {
    const espera = setTimeout(() => setRetardado(valor), ms)
    return () => clearTimeout(espera)
  }, [valor, ms])
  return retardado
}

interface Props {
  alVerHistorial: (entidad: string, id: string) => void
}

export default function EventosPestana({ alVerHistorial }: Props) {
  const [pagina, setPagina] = useState(1)
  const [usuario, setUsuario] = useState('')
  const [accion, setAccion] = useState('')
  const [entidad, setEntidad] = useState('')
  const [resultado, setResultado] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [detalle, setDetalle] = useState<EventoAuditoria | null>(null)

  const usuarioBuscado = useRetardo(usuario.trim())
  const accionBuscada = useRetardo(accion.trim())
  const entidadBuscada = useRetardo(entidad.trim())

  // Al cambiar un filtro de texto, se vuelve a la primera página
  useEffect(() => {
    setPagina(1)
  }, [usuarioBuscado, accionBuscada, entidadBuscada])

  const rangoInvalido = desde !== '' && hasta !== '' && hasta < desde

  const consulta = useQuery({
    queryKey: ['auditoria', { pagina, usuarioBuscado, accionBuscada, entidadBuscada, resultado, desde, hasta }],
    queryFn: () =>
      api.get<RespuestaPaginada<EventoAuditoria>>('/auditoria', {
        pagina,
        por_pagina: POR_PAGINA,
        usuario_email: usuarioBuscado,
        accion: accionBuscada,
        entidad: entidadBuscada,
        resultado,
        desde,
        hasta,
      }),
    enabled: !rangoInvalido,
    placeholderData: keepPreviousData,
  })

  const eventos = consulta.data?.datos ?? []
  const hayFiltros = usuario !== '' || accion !== '' || entidad !== '' || resultado !== '' || desde !== '' || hasta !== ''

  function limpiarFiltros() {
    setUsuario('')
    setAccion('')
    setEntidad('')
    setResultado('')
    setDesde('')
    setHasta('')
    setPagina(1)
  }

  return (
    <>
      <Row className="g-2 mb-3 align-items-start">
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="aud-desde">
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
          <Form.Group controlId="aud-hasta">
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
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="aud-resultado">
            <Form.Label>Resultado</Form.Label>
            <Form.Select
              value={resultado}
              onChange={(e) => {
                setResultado(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos los resultados</option>
              <option value="ok">Correcto</option>
              <option value="denegado">Denegado</option>
              <option value="error">Error</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="aud-usuario">
            <Form.Label>Usuario</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <Search size={16} aria-hidden="true" />
              </InputGroup.Text>
              <Form.Control type="search" placeholder="Correo del usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
            </InputGroup>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="aud-accion">
            <Form.Label>Acción</Form.Label>
            <Form.Control type="search" list="aud-acciones" placeholder="Ej. LOGIN" value={accion} onChange={(e) => setAccion(e.target.value)} />
            <datalist id="aud-acciones">
              {ACCIONES_AUDITORIA.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="aud-entidad">
            <Form.Label>Entidad</Form.Label>
            <Form.Control
              type="search"
              list="aud-entidades"
              placeholder="Nombre exacto, ej. usuarios"
              title="Coincide exactamente con el nombre."
              aria-describedby="aud-entidad-ayuda"
              value={entidad}
              onChange={(e) => setEntidad(e.target.value)}
            />
            <datalist id="aud-entidades">
              {ENTIDADES_AUDITORIA.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
            <span id="aud-entidad-ayuda" className="visually-hidden">
              Coincide exactamente con el nombre.
            </span>
          </Form.Group>
        </Col>
      </Row>

      <Card>
        {rangoInvalido ? (
          <SinDatos titulo="Revisa el rango de fechas" descripcion="La fecha final no puede ser anterior a la inicial." />
        ) : consulta.isPending ? (
          <Cargando texto="Cargando eventos…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : eventos.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'No hay eventos con esos filtros' : 'Aún no hay eventos de auditoría'}
            descripcion={hayFiltros ? 'Prueba con otros filtros.' : undefined}
            accion={
              hayFiltros ? (
                <Button size="sm" variant="secondary" onClick={limpiarFiltros}>
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
                <th>Fecha</th>
                <th className="d-none d-lg-table-cell">Usuario</th>
                <th className="d-none d-lg-table-cell">Acción</th>
                <th className="d-none d-lg-table-cell">Entidad</th>
                <th className="d-none d-lg-table-cell">Resultado</th>
                <th className="d-none d-lg-table-cell text-end text-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="fw-semibold numeros-tabulares text-nowrap">{formatearFechaHora(e.created_at)}</div>

                    {/* Celular y tablet: todo apilado bajo la fecha (dos columnas en tablet) */}
                    <div className="d-lg-none mt-1">
                      <Row className="g-2">
                        <Col xs={12} md={6}>
                          <div className="font-monospace small fw-semibold text-break">{e.accion}</div>
                          <small className="text-body-secondary text-break d-block">{e.usuario_email ?? 'Sin sesión'}</small>
                          {e.entidad && (
                            <small className="text-body-secondary text-break d-block">
                              {e.entidad}
                              {e.entidad_id ? ` · ${e.entidad_id}` : ''}
                            </small>
                          )}
                        </Col>
                        <Col xs={12} md={6}>
                          <div className="mb-2">
                            <ResultadoBadge resultado={e.resultado} />
                          </div>
                          <Button size="sm" variant="secondary" className="text-nowrap" onClick={() => setDetalle(e)}>
                            Ver detalle
                          </Button>
                        </Col>
                      </Row>
                    </div>
                  </td>
                  <td className="d-none d-lg-table-cell text-break">{e.usuario_email ?? <span className="text-body-secondary">Sin sesión</span>}</td>
                  <td className="d-none d-lg-table-cell">
                    <span className="font-monospace small">{e.accion}</span>
                  </td>
                  <td className="d-none d-lg-table-cell">
                    <div className="text-break">{e.entidad ?? '—'}</div>
                    {e.entidad_id && <small className="text-body-secondary text-break d-block">{e.entidad_id}</small>}
                  </td>
                  <td className="d-none d-lg-table-cell">
                    <ResultadoBadge resultado={e.resultado} />
                  </td>
                  <td className="d-none d-lg-table-cell text-end text-nowrap">
                    <Button size="sm" variant="secondary" className="text-nowrap" aria-label={`Ver detalle del evento ${e.accion}`} onClick={() => setDetalle(e)}>
                      Ver detalle
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {consulta.data && !rangoInvalido && <Paginacion meta={consulta.data.meta} alCambiar={setPagina} deshabilitado={consulta.isPlaceholderData} />}

      <EventoDetalle
        evento={detalle}
        alCerrar={() => setDetalle(null)}
        alVerHistorial={(entidadHistorial, id) => {
          setDetalle(null)
          alVerHistorial(entidadHistorial, id)
        }}
      />
    </>
  )
}