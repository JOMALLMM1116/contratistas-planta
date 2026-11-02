import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Col, Form, InputGroup, Row, Table } from 'react-bootstrap'
import { Search, X } from 'lucide-react'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import EstadoBadge from '../../componentes/EstadoBadge'
import Paginacion from '../../componentes/Paginacion'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import { infoEstado } from '../../utilidades/estados'
import { formatearDia } from '../../utilidades/fechas'
import { useSolicitudes } from './solicitudes.api'
import { ESTADOS_SOLICITUD } from './tipos'

export default function SolicitudesPagina() {
  const navegar = useNavigate()

  // Los filtros viven en la URL: se pueden compartir, y "atrás" del navegador los conserva
  const [params, setParams] = useSearchParams()
  const pagina = Number(params.get('pagina')) || 1
  const estado = params.get('estado') ?? ''
  const buscar = params.get('buscar') ?? ''
  const [texto, setTexto] = useState(buscar)

  const consulta = useSolicitudes({ pagina, estado: estado || undefined, buscar: buscar || undefined })

  // Cambiar un filtro vuelve a la página 1
  function cambiarFiltros(cambios: { estado?: string; buscar?: string; pagina?: number }) {
    const nuevos = new URLSearchParams(params)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === undefined || valor === '' || valor === 1) nuevos.delete(clave)
      else nuevos.set(clave, String(valor))
    }
    if (cambios.pagina === undefined) nuevos.delete('pagina')
    setParams(nuevos)
  }

  function enviarBusqueda(e: FormEvent) {
    e.preventDefault()
    cambiarFiltros({ buscar: texto.trim() })
  }

  function limpiar() {
    setTexto('')
    setParams(new URLSearchParams())
  }

  const hayFiltros = estado !== '' || buscar !== ''

  return (
    <>
      <EncabezadoPagina titulo="Solicitudes de acceso" descripcion="Solicitudes de contratistas para ingresar a la planta." />

      <Card className="shadow-sm">
        {/* Filtros */}
        <Card.Body className="border-bottom">
          <Row className="g-2 align-items-end">
            <Col md={6} lg={5}>
              <Form onSubmit={enviarBusqueda}>
                <Form.Label htmlFor="buscar-solicitud" className="small text-body-secondary mb-1">
                  Buscar
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    id="buscar-solicitud"
                    placeholder="Código o actividad"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                  />
                  <Button type="submit" variant="outline-secondary" aria-label="Buscar" title="Buscar">
                    <Search size={18} />
                  </Button>
                </InputGroup>
              </Form>
            </Col>
            <Col sm={6} md={4} lg={3}>
              <Form.Label htmlFor="estado-solicitud" className="small text-body-secondary mb-1">
                Estado
              </Form.Label>
              <Form.Select id="estado-solicitud" value={estado} onChange={(e) => cambiarFiltros({ estado: e.target.value })}>
                <option value="">Todos</option>
                {ESTADOS_SOLICITUD.map((e) => (
                  <option key={e} value={e}>
                    {infoEstado('solicitud', e).texto}
                  </option>
                ))}
              </Form.Select>
            </Col>
            {hayFiltros && (
              <Col xs="auto">
                <Button variant="link" className="d-inline-flex align-items-center gap-1 px-0" onClick={limpiar}>
                  <X size={16} /> Limpiar filtros
                </Button>
              </Col>
            )}
          </Row>
        </Card.Body>

        {/* Resultados */}
        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : consulta.data.datos.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'Ninguna solicitud coincide' : 'Aún no hay solicitudes'}
            descripcion={hayFiltros ? 'Prueba con otros filtros.' : undefined}
          />
        ) : (
          <>
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Empresa</th>
                  <th className="d-none d-md-table-cell">Tipo de trabajo</th>
                  <th>Vigencia</th>
                  <th className="d-none d-lg-table-cell">Horario</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {consulta.data.datos.map((s) => (
                  <tr key={s.id} onClick={() => navegar(`/solicitudes/${s.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="fw-semibold text-nowrap">
                      <Link to={`/solicitudes/${s.id}`} onClick={(e) => e.stopPropagation()}>
                        {s.codigo}
                      </Link>
                    </td>
                    <td>{s.empresas_contratistas.razon_social}</td>
                    <td className="d-none d-md-table-cell">{s.tipos_trabajo.nombre}</td>
                    <td className="text-nowrap">
                      {formatearDia(s.fecha_inicio)} – {formatearDia(s.fecha_fin)}
                    </td>
                    <td className="d-none d-lg-table-cell text-nowrap">
                      {s.hora_inicio} – {s.hora_fin}
                    </td>
                    <td>
                      <EstadoBadge entidad="solicitud" estado={s.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Card.Body className="pt-0">
              <Paginacion
                meta={consulta.data.meta}
                alCambiar={(p) => cambiarFiltros({ pagina: p, estado, buscar })}
                deshabilitado={consulta.isFetching}
              />
            </Card.Body>
          </>
        )}
      </Card>
    </>
  )
}
