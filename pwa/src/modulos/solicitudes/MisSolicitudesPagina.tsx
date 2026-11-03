import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Form } from 'react-bootstrap'
import EstadoBadge from '../../componentes/EstadoBadge'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import { infoEstado } from '../../utilidades/estados'
import { formatearDia } from '../../utilidades/fechas'
import { hora } from './ayudas'
import { useSolicitudes } from './solicitudes.api'
import { ESTADOS_SOLICITUD } from './tipos'

export default function MisSolicitudesPagina() {
  const [pagina, setPagina] = useState(1)
  const [estado, setEstado] = useState('')
  const consulta = useSolicitudes(pagina, estado)

  const solicitudes = consulta.data?.datos ?? []
  const meta = consulta.data?.meta

  return (
    <>
      <h1 className="h5 mb-3">Solicitudes</h1>

      <Form.Group className="mb-3" controlId="filtro-estado">
        <Form.Label className="visually-hidden">Filtrar por estado</Form.Label>
        <Form.Select
          size="lg"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value)
            setPagina(1)
          }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_SOLICITUD.map((e) => (
            <option key={e} value={e}>
              {infoEstado('solicitud', e).texto}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      {consulta.isPending ? (
        <Cargando texto="Cargando tus solicitudes…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
      ) : solicitudes.length === 0 ? (
        <SinDatos
          titulo={estado ? 'No hay solicitudes con ese estado' : 'Aún no hay solicitudes'}
          descripcion={estado ? 'Prueba con otro estado.' : 'Aquí aparecerán las solicitudes de acceso donde participas.'}
        />
      ) : (
        <>
          <div className="d-flex flex-column gap-3">
            {solicitudes.map((s) => {
              const personas = s._count.solicitud_contratistas
              return (
                <Link key={s.id} to={`/solicitudes/${s.id}`} className="text-decoration-none text-reset d-block">
                  <Card>
                    <Card.Body>
                      <div className="d-flex align-items-start justify-content-between gap-2">
                        <div className="fw-semibold numeros-tabulares">{s.codigo}</div>
                        <EstadoBadge entidad="solicitud" estado={s.estado} />
                      </div>
                      <div className="mt-1">{s.tipos_trabajo.nombre}</div>
                      <div className="text-truncate">{s.descripcion_actividad}</div>
                      <div className="small mt-2 numeros-tabulares">
                        {formatearDia(s.fecha_inicio)} – {formatearDia(s.fecha_fin)} · {hora(s.hora_inicio)} – {hora(s.hora_fin)}
                      </div>
                      <div className="small">
                        {s.empresas_contratistas.razon_social} · {personas} {personas === 1 ? 'persona' : 'personas'}
                      </div>
                    </Card.Body>
                  </Card>
                </Link>
              )
            })}
          </div>

          {meta && meta.total_paginas > 1 && (
            <div className="d-flex align-items-center justify-content-between gap-2 mt-3">
              <Button variant="secondary" disabled={pagina <= 1 || consulta.isPlaceholderData} onClick={() => setPagina((p) => p - 1)}>
                Anterior
              </Button>
              <span className="small numeros-tabulares">
                Página {meta.pagina} de {meta.total_paginas}
              </span>
              <Button variant="secondary" disabled={pagina >= meta.total_paginas || consulta.isPlaceholderData} onClick={() => setPagina((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}