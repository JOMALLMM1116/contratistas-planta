import { useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { LogIn, LogOut, X } from 'lucide-react'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import Paginacion from '../../componentes/Paginacion'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import { formatearFechaHora } from '../../utilidades/fechas'
import { useMovimientos } from './garita.api'

export default function MovimientosPagina() {
  const [pagina, setPagina] = useState(1)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // Si el rango está al revés, no se consulta con él
  const rangoInvalido = desde !== '' && hasta !== '' && hasta < desde
  const consulta = useMovimientos({
    pagina,
    desde: rangoInvalido ? undefined : desde || undefined,
    hasta: rangoInvalido ? undefined : hasta || undefined,
  })

  const hayFiltros = desde !== '' || hasta !== ''

  return (
    <>
      <EncabezadoPagina titulo="Movimientos" descripcion="Entradas y salidas registradas en garita." />

      <Card className="shadow-sm">
        <Card.Body className="border-bottom">
          <Row className="g-2 align-items-end">
            <Col sm={6} md={3}>
              <Form.Label htmlFor="mov-desde" className="small text-body-secondary mb-1">
                Desde
              </Form.Label>
              <Form.Control
                id="mov-desde"
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value)
                  setPagina(1)
                }}
              />
            </Col>
            <Col sm={6} md={3}>
              <Form.Label htmlFor="mov-hasta" className="small text-body-secondary mb-1">
                Hasta
              </Form.Label>
              <Form.Control
                id="mov-hasta"
                type="date"
                value={hasta}
                isInvalid={rangoInvalido}
                onChange={(e) => {
                  setHasta(e.target.value)
                  setPagina(1)
                }}
              />
            </Col>
            {hayFiltros && (
              <Col xs="auto">
                <Button
                  variant="link"
                  className="d-inline-flex align-items-center gap-1 px-0"
                  onClick={() => {
                    setDesde('')
                    setHasta('')
                    setPagina(1)
                  }}
                >
                  <X size={16} /> Limpiar filtros
                </Button>
              </Col>
            )}
          </Row>
          {rangoInvalido && (
            <Alert variant="warning" className="py-2 mt-2 mb-0">
              La fecha "hasta" no puede ser anterior a "desde".
            </Alert>
          )}
        </Card.Body>

        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : consulta.data.datos.length === 0 ? (
          <SinDatos titulo="Sin movimientos" descripcion={hayFiltros ? 'Prueba con otras fechas.' : undefined} />
        ) : (
          <>
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Movimiento</th>
                  <th>Persona</th>
                  <th className="d-none d-md-table-cell">Empresa</th>
                  <th>Zona</th>
                  <th className="d-none d-lg-table-cell">Solicitud</th>
                  <th className="d-none d-lg-table-cell">Credencial</th>
                  <th className="d-none d-xl-table-cell">Registró</th>
                </tr>
              </thead>
              <tbody>
                {consulta.data.datos.map((m) => (
                  <tr key={m.id}>
                    <td className="text-nowrap">{formatearFechaHora(m.fecha_hora)}</td>
                    <td>
                      {m.tipo === 'entrada' ? (
                        <Badge bg="success-subtle" text="success-emphasis" className="d-inline-flex align-items-center gap-1">
                          <LogIn size={13} aria-hidden="true" /> Entrada
                        </Badge>
                      ) : (
                        <Badge bg="body-tertiary" text="body-secondary" className="d-inline-flex align-items-center gap-1 border">
                          <LogOut size={13} aria-hidden="true" /> Salida
                        </Badge>
                      )}
                    </td>
                    <td>
                      {m.nombres} {m.apellidos}
                    </td>
                    <td className="d-none d-md-table-cell">{m.empresa}</td>
                    <td>{m.zona}</td>
                    <td className="d-none d-lg-table-cell">{m.solicitud}</td>
                    <td className="d-none d-lg-table-cell numeros-tabulares">{m.credencial}</td>
                    <td className="d-none d-xl-table-cell small">{m.registrado_por}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Card.Body className="pt-0">
              <Paginacion meta={consulta.data.meta} alCambiar={setPagina} deshabilitado={consulta.isFetching} />
            </Card.Body>
          </>
        )}
      </Card>
    </>
  )
}
