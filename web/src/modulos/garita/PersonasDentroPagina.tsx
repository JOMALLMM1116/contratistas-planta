import { useState } from 'react'
import { Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { LogOut } from 'lucide-react'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import { ErrorApi } from '../../api/cliente'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { formatearDuracion, formatearFechaHora } from '../../utilidades/fechas'
import { useDentro, useSalida, useZonasGarita } from './garita.api'
import type { PersonaDentro } from './tipos'

export default function PersonasDentroPagina() {
  const { perfil } = useSesion()
  const puedeRegistrar = tienePermiso(perfil, 'garita.registrar_acceso')

  const [zonaId, setZonaId] = useState<number | null>(null)
  const zonas = useZonasGarita()
  const dentro = useDentro(zonaId)
  const salida = useSalida()
  const [saliendo, setSaliendo] = useState<PersonaDentro | null>(null)

  return (
    <>
      <EncabezadoPagina
        titulo="Personas dentro"
        descripcion="Contratistas que están en la planta en este momento. Se actualiza cada 30 segundos."
        acciones={
          dentro.data && (
            <Badge bg="primary-subtle" text="primary-emphasis" className="fs-6 align-self-center">
              {dentro.data.length} {dentro.data.length === 1 ? 'persona' : 'personas'}
            </Badge>
          )
        }
      />

      <Card className="shadow-sm">
        <Card.Body className="border-bottom">
          <Row className="g-2">
            <Col sm={6} md={4}>
              <Form.Label htmlFor="zona-dentro" className="small text-body-secondary mb-1">
                Zona
              </Form.Label>
              <Form.Select
                id="zona-dentro"
                value={zonaId ?? ''}
                onChange={(e) => setZonaId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Todas las zonas</option>
                {zonas.data?.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.codigo} · {z.nombre}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>

        {dentro.isPending ? (
          <Cargando />
        ) : dentro.isError ? (
          <ErrorCarga error={dentro.error} alReintentar={() => void dentro.refetch()} />
        ) : dentro.data.length === 0 ? (
          <SinDatos titulo="No hay nadie dentro" descripcion={zonaId ? 'Prueba con otra zona.' : undefined} />
        ) : (
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Persona</th>
                <th className="d-none d-md-table-cell">Empresa</th>
                <th>Zona</th>
                <th className="d-none d-lg-table-cell">Credencial</th>
                <th className="d-none d-sm-table-cell">Entrada</th>
                <th>Tiempo dentro</th>
                {puedeRegistrar && <th className="text-end">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {dentro.data.map((p) => (
                <tr key={p.contratista_id}>
                  <td>
                    <div className="fw-semibold">
                      {p.nombres} {p.apellidos}
                    </div>
                    <div className="small text-body-secondary numeros-tabulares">{p.documento_identidad}</div>
                  </td>
                  <td className="d-none d-md-table-cell">{p.empresa}</td>
                  <td>
                    <span className="fw-semibold">{p.zona_codigo}</span>
                    <div className="small text-body-secondary">{p.zona_nombre}</div>
                  </td>
                  <td className="d-none d-lg-table-cell numeros-tabulares">
                    {p.credencial}
                    <div className="small text-body-secondary">{p.solicitud}</div>
                  </td>
                  <td className="d-none d-sm-table-cell text-nowrap">{formatearFechaHora(p.ingreso_en)}</td>
                  <td className="text-nowrap">{formatearDuracion(p.minutos_dentro)}</td>
                  {puedeRegistrar && (
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="d-inline-flex align-items-center gap-1"
                        onClick={() => {
                          salida.reset()
                          setSaliendo(p)
                        }}
                      >
                        <LogOut size={16} /> Registrar salida
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <ConfirmarAccion
        mostrar={saliendo !== null}
        titulo="Registrar salida"
        mensaje={saliendo ? `Se registrará la salida de ${saliendo.nombres} ${saliendo.apellidos} (zona ${saliendo.zona_codigo}).` : ''}
        textoConfirmar="Registrar salida"
        procesando={salida.isPending}
        error={salida.error instanceof ErrorApi ? salida.error.message : salida.error ? 'No se pudo registrar la salida.' : null}
        alConfirmar={() => {
          if (!saliendo) return
          salida.mutate({ contratista_id: saliendo.contratista_id }, { onSuccess: () => setSaliendo(null) })
        }}
        alCancelar={() => setSaliendo(null)}
      />
    </>
  )
}
