import { useState } from 'react'
import { Card, Col, Form, Row, Table } from 'react-bootstrap'
import { Building2, CirclePlay, ClipboardList, Clock, FileCheck, FileText, GraduationCap, HardHat } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { useDashboard } from './dashboard.api'
import GraficaEstados from './GraficaEstados'
import type { ConteoVencimientos } from './tipos'

const OPCIONES_DIAS = [7, 15, 30, 60, 90]
const ESTADOS_SOLICITUD = ['borrador', 'pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada', 'vencida', 'revocada']
const ESTADOS_PERMISO = ['emitido', 'en_ejecucion', 'cerrado', 'revocado', 'vencido']

/** "2026-11-03 01:23" → "03/11/2026 01:23" */
function formatoGenerado(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(valor)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : valor
}

function TarjetaCifra({ titulo, valor, icono: Icono, detalle }: { titulo: string; valor: number; icono: LucideIcon; detalle?: string }) {
  return (
    <Card className="h-100">
      <Card.Body>
        <div className="d-flex align-items-center gap-2 mb-2">
          <Icono size={18} aria-hidden="true" />
          <span className="small fw-semibold">{titulo}</span>
        </div>
        <div className="fs-2 fw-semibold numeros-tabulares lh-1">{valor}</div>
        {detalle && <div className="small mt-2">{detalle}</div>}
      </Card.Body>
    </Card>
  )
}

function TarjetaVencimientos({
  titulo,
  icono: Icono,
  conteo,
  diasPorVencer,
  diasVencidos,
}: {
  titulo: string
  icono: LucideIcon
  conteo: ConteoVencimientos
  diasPorVencer: number
  diasVencidos: number
}) {
  return (
    <Card className="h-100">
      <Card.Body>
        <div className="d-flex align-items-center gap-2 mb-3">
          <Icono size={18} aria-hidden="true" />
          <span className="small fw-semibold">{titulo}</span>
        </div>
        <Row className="g-2 text-center">
          <Col xs={6}>
            <div className={`fs-3 fw-semibold numeros-tabulares lh-1${conteo.por_vencer > 0 ? ' text-warning-emphasis' : ''}`}>{conteo.por_vencer}</div>
            <div className="small mt-1">Por vencer en {diasPorVencer} días</div>
          </Col>
          <Col xs={6}>
            <div className={`fs-3 fw-semibold numeros-tabulares lh-1${conteo.vencidos > 0 ? ' text-danger-emphasis' : ''}`}>{conteo.vencidos}</div>
            <div className="small mt-1">Vencidos en los últimos {diasVencidos} días</div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  )
}

export default function DashboardInicio() {
  const [dias, setDias] = useState(30)
  const consulta = useDashboard(dias)
  const d = consulta.data

  const selector = (
    <Form.Select aria-label="Días para los vencimientos" className="w-auto" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
      {OPCIONES_DIAS.map((n) => (
        <option key={n} value={n}>
          Vencimientos: {n} días
        </option>
      ))}
    </Form.Select>
  )

  return (
    <>
      <EncabezadoPagina
        titulo="Panel de control"
        descripcion={d ? `Actualizado el ${formatoGenerado(d.generado_en)}` : 'Resumen de la operación de la planta.'}
        acciones={selector}
      />

      {consulta.isPending ? (
        <Cargando texto="Cargando el panel…" />
      ) : consulta.isError || !d ? (
        <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
      ) : (
        <>
          <Row className="g-3 mb-3">
            <Col xs={6} lg={3}>
              <TarjetaCifra titulo="Solicitudes" valor={d.solicitudes.total} icono={ClipboardList} detalle={`${d.solicitudes.por_estado.aprobada ?? 0} aprobadas`} />
            </Col>
            <Col xs={6} lg={3}>
              <TarjetaCifra
                titulo="Por revisar"
                valor={(d.solicitudes.por_estado.pendiente ?? 0) + (d.solicitudes.por_estado.en_revision ?? 0)}
                icono={Clock}
                detalle="Pendientes y en revisión"
              />
            </Col>
            <Col xs={6} lg={3}>
              <TarjetaCifra titulo="Permisos en ejecución" valor={d.permisos.por_estado.en_ejecucion ?? 0} icono={CirclePlay} detalle={`${d.permisos.total} permisos en total`} />
            </Col>
            <Col xs={6} lg={3}>
              <TarjetaCifra titulo="Permisos vigentes hoy" valor={d.permisos.vigentes_hoy} icono={FileCheck} detalle="Dentro de su fecha de vigencia" />
            </Col>
          </Row>

          <Row className="g-3 mb-3">
            <Col xs={12} md={6} lg={4}>
              <TarjetaVencimientos
                titulo="Documentos"
                icono={FileText}
                conteo={d.vencimientos.documentos}
                diasPorVencer={d.por_vencer_dias}
                diasVencidos={d.vencidos_ultimos_dias}
              />
            </Col>
            <Col xs={12} md={6} lg={4}>
              <TarjetaVencimientos
                titulo="Capacitaciones"
                icono={GraduationCap}
                conteo={d.vencimientos.capacitaciones}
                diasPorVencer={d.por_vencer_dias}
                diasVencidos={d.vencidos_ultimos_dias}
              />
            </Col>
            <Col xs={6} lg={2}>
              <TarjetaCifra titulo="Empresas activas" valor={d.totales.empresas_activas} icono={Building2} />
            </Col>
            <Col xs={6} lg={2}>
              <TarjetaCifra titulo="Contratistas activos" valor={d.totales.contratistas_activos} icono={HardHat} detalle={`${d.totales.equipos_activos} equipos activos`} />
            </Col>
          </Row>

          <Row className="g-3 mb-3">
            <Col xs={12} lg={6}>
              <GraficaEstados titulo="Solicitudes por estado" entidad="solicitud" orden={ESTADOS_SOLICITUD} conteos={d.solicitudes.por_estado} />
            </Col>
            <Col xs={12} lg={6}>
              <GraficaEstados titulo="Permisos de trabajo por estado" entidad="permiso_trabajo" orden={ESTADOS_PERMISO} conteos={d.permisos.por_estado} />
            </Col>
          </Row>

          <Card>
            <Card.Body className="pb-0">
              <h2 className="h6 mb-2">Empresas con más contratistas</h2>
            </Card.Body>
            {d.empresas_top.length === 0 ? (
              <Card.Body className="pt-0">
                <p className="mb-0">Aún no hay empresas registradas.</p>
              </Card.Body>
            ) : (
              <Table responsive className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th className="text-end">Contratistas</th>
                    <th className="text-end">Equipos</th>
                  </tr>
                </thead>
                <tbody>
                  {d.empresas_top.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div className="fw-semibold">{e.razon_social}</div>
                        <small>NIT {e.nit}</small>
                      </td>
                      <td className="text-end numeros-tabulares">{e.contratistas}</td>
                      <td className="text-end numeros-tabulares">{e.equipos}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </>
  )
}