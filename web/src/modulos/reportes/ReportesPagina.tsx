import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaPaginada } from '../../api/tipos'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import { CONFIG, TIPOS } from './config'
import { useDescargaReporte, useVistaPrevia } from './reportes.api'
import type { EmpresaOpcion, FiltrosReporte, TipoReporte } from './tipos'

const MAX_FILAS = 50

/** Valor de una celda: la fila es un objeto por "clave" (o un arreglo por posición) */
function valorCelda(fila: unknown, clave: string, indice: number): string {
  const v = Array.isArray(fila) ? fila[indice] : (fila as Record<string, unknown> | null)?.[clave]
  return v === null || v === undefined || v === '' ? '—' : String(v)
}

export default function ReportesPagina() {
  const [filtros, setFiltros] = useState<FiltrosReporte>({ tipo: 'solicitudes', empresa_id: '', estado: '', desde: '', hasta: '', dias: '30' })
  const cfg = CONFIG[filtros.tipo]

  const cambiar = (parcial: Partial<FiltrosReporte>) => setFiltros((f) => ({ ...f, ...parcial }))

  const empresas = useQuery({
    queryKey: ['empresas-reportes'],
    queryFn: () => api.get<RespuestaPaginada<EmpresaOpcion>>('/empresas-contratistas', { por_pagina: 100, ordenar_por: 'razon_social' }),
    staleTime: 5 * 60_000,
  })

  const rangoInvalido = cfg.fechas && filtros.desde !== '' && filtros.hasta !== '' && filtros.hasta < filtros.desde
  const diasNumero = Number(filtros.dias)
  const diasInvalidos = cfg.dias && (filtros.dias === '' || !Number.isInteger(diasNumero) || diasNumero < 0 || diasNumero > 365)

  const vista = useVistaPrevia(filtros, !rangoInvalido && !diasInvalidos)
  const descarga = useDescargaReporte()

  const reporte = vista.data?.datos
  const total = vista.data?.total ?? 0
  const filas = (reporte?.filas ?? []).slice(0, MAX_FILAS)

  return (
    <>
      <EncabezadoPagina titulo="Reportes" descripcion="Consulta la información de la planta y descárgala en Excel o PDF con los mismos filtros." />

      <Row className="g-2 mb-3 align-items-start">
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="rep-tipo">
            <Form.Label>Reporte</Form.Label>
            <Form.Select value={filtros.tipo} onChange={(e) => cambiar({ tipo: e.target.value as TipoReporte, estado: '' })}>
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {CONFIG[tipo].texto}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="rep-empresa">
            <Form.Label>Empresa</Form.Label>
            <Form.Select value={filtros.empresa_id} onChange={(e) => cambiar({ empresa_id: e.target.value })}>
              <option value="">Todas las empresas</option>
              {(empresas.data?.datos ?? []).map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.razon_social}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        {cfg.estados.length > 0 && (
          <Col xs={12} md={6} lg={3}>
            <Form.Group controlId="rep-estado">
              <Form.Label>Estado</Form.Label>
              <Form.Select value={filtros.estado} onChange={(e) => cambiar({ estado: e.target.value })}>
                <option value="">Todos los estados</option>
                {cfg.estados.map((estado) => (
                  <option key={estado.valor} value={estado.valor}>
                    {estado.texto}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        )}

        {cfg.fechas && (
          <>
            <Col xs={12} md={6} lg={3}>
              <Form.Group controlId="rep-desde">
                <Form.Label>Desde</Form.Label>
                <Form.Control type="date" value={filtros.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
              </Form.Group>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Form.Group controlId="rep-hasta">
                <Form.Label>Hasta</Form.Label>
                <Form.Control type="date" value={filtros.hasta} isInvalid={rangoInvalido} onChange={(e) => cambiar({ hasta: e.target.value })} />
                <Form.Control.Feedback type="invalid">La fecha final no puede ser anterior a la inicial.</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </>
        )}

        {cfg.dias && (
          <Col xs={12} md={6} lg={3}>
            <Form.Group controlId="rep-dias">
              <Form.Label>Días hacia adelante</Form.Label>
              <Form.Control type="number" min={0} max={365} value={filtros.dias} isInvalid={diasInvalidos} onChange={(e) => cambiar({ dias: e.target.value })} />
              <Form.Control.Feedback type="invalid">Escribe un número de 0 a 365.</Form.Control.Feedback>
            </Form.Group>
          </Col>
        )}
      </Row>

      {descarga.isError && (
        <Alert variant="danger" dismissible onClose={() => descarga.reset()}>
          {descarga.error instanceof ErrorApi ? descarga.error.message : 'No se pudo descargar el reporte. Intenta de nuevo.'}
        </Alert>
      )}

      <Card>
        {rangoInvalido || diasInvalidos ? (
          <SinDatos titulo="Revisa los filtros" descripcion={rangoInvalido ? 'La fecha final no puede ser anterior a la inicial.' : 'Los días deben estar entre 0 y 365.'} />
        ) : vista.isPending ? (
          <Cargando texto="Generando la vista previa…" />
        ) : vista.isError || !reporte ? (
          <ErrorCarga error={vista.error} alReintentar={() => void vista.refetch()} />
        ) : (
          <>
            <Card.Body className="d-flex flex-wrap align-items-start justify-content-between gap-3">
              <div>
                <h2 className="h6 mb-1">{reporte.titulo}</h2>
                {reporte.subtitulo.map((linea) => (
                  <div key={linea} className="small">
                    {linea}
                  </div>
                ))}
                <div className="small fw-semibold mt-1 numeros-tabulares">{total} {total === 1 ? 'registro' : 'registros'}</div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  className="d-inline-flex align-items-center gap-1 text-nowrap"
                  disabled={descarga.isPending || total === 0}
                  onClick={() => descarga.mutate({ filtros, formato: 'excel' })}
                >
                  {descarga.isPending && descarga.variables?.formato === 'excel' ? <Spinner animation="border" size="sm" /> : <FileSpreadsheet size={16} aria-hidden="true" />}
                  Descargar Excel
                </Button>
                <Button
                  variant="secondary"
                  className="d-inline-flex align-items-center gap-1 text-nowrap"
                  disabled={descarga.isPending || total === 0}
                  onClick={() => descarga.mutate({ filtros, formato: 'pdf' })}
                >
                  {descarga.isPending && descarga.variables?.formato === 'pdf' ? <Spinner animation="border" size="sm" /> : <FileText size={16} aria-hidden="true" />}
                  Descargar PDF
                </Button>
              </div>
            </Card.Body>

            {total === 0 ? (
              <SinDatos titulo="No hay registros con esos filtros" descripcion="Prueba con otros filtros." />
            ) : (
              <>
                <Table responsive size="sm" hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      {reporte.columnas.map((col) => (
                        <th key={col.clave} className="text-nowrap">
                          {col.titulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((fila, i) => (
                      <tr key={i}>
                        {reporte.columnas.map((col, j) => (
                          <td key={col.clave}>{valorCelda(fila, col.clave, j)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {total > MAX_FILAS && (
                  <Card.Body className="small">
                    Vista previa de las primeras {MAX_FILAS} filas de {total}.
                  </Card.Body>
                )}
              </>
            )}
          </>
        )}
      </Card>
    </>
  )
}