import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Alert, Badge, Button, Card } from 'react-bootstrap'
import { Camera, Download } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { formatearFechaHora } from '../../utilidades/fechas'
import { TEXTO_MOMENTO } from './ayudas'
import EvidenciaNueva from './EvidenciaNueva'
import { useEvidencias } from './permisos.api'
import type { Evidencia, EstadoPermiso, MomentoEvidencia } from './tipos'

/** Momento que se propone según el estado del permiso */
const MOMENTO_SUGERIDO: Record<EstadoPermiso, MomentoEvidencia> = {
  emitido: 'inicio',
  en_ejecucion: 'durante',
  cerrado: 'cierre',
  revocado: 'durante',
  vencido: 'durante',
}

export default function EvidenciasPermiso({ permisoId, estado }: { permisoId: string; estado: EstadoPermiso }) {
  const { perfil } = useSesion()
  const consulta = useEvidencias(permisoId)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [agregada, setAgregada] = useState(false)

  // El servidor no acepta evidencias en un permiso revocado o vencido
  const puedeAgregar = tienePermiso(perfil, 'evidencias.registrar') && (estado === 'emitido' || estado === 'en_ejecucion' || estado === 'cerrado')

  const descarga = useMutation({
    mutationFn: (e: Evidencia) => api.descargar(`/archivos/${e.archivos.id}/descargar`, e.archivos.nombre_original),
  })

  return (
    <section className="mb-4" aria-labelledby="titulo-evidencias">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <h2 className="h6 mb-0" id="titulo-evidencias">
          Evidencias{consulta.data ? ` (${consulta.data.length})` : ''}
        </h2>
        {puedeAgregar && (
          <Button
            className="d-inline-flex align-items-center gap-2"
            onClick={() => {
              setAgregada(false)
              setMostrarNueva(true)
            }}
          >
            <Camera size={18} aria-hidden="true" /> Agregar
          </Button>
        )}
      </div>

      {agregada && (
        <Alert variant="success" dismissible onClose={() => setAgregada(false)}>
          Evidencia agregada.
        </Alert>
      )}
      {descarga.isError && (
        <Alert variant="danger" dismissible onClose={() => descarga.reset()}>
          {descarga.error instanceof ErrorApi ? descarga.error.message : 'No se pudo descargar el archivo.'}
        </Alert>
      )}

      {consulta.isPending ? (
        <Cargando texto="Cargando evidencias…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
      ) : consulta.data.length === 0 ? (
        <Card body>Todavía no hay evidencias.</Card>
      ) : (
        <div className="d-flex flex-column gap-2">
          {consulta.data.map((e) => (
            <Card key={e.id}>
              <Card.Body className="d-flex align-items-start justify-content-between gap-2">
                <div className="text-break">
                  <div className="fw-semibold">{e.archivos.nombre_original}</div>
                  <Badge bg="body-tertiary" text="body-emphasis" className="border">
                    {TEXTO_MOMENTO[e.momento] ?? e.momento}
                  </Badge>
                  {e.descripcion && <div className="small mt-1">{e.descripcion}</div>}
                  <div className="small numeros-tabulares mt-1">{formatearFechaHora(e.created_at)}</div>
                </div>
                <Button variant="secondary" size="sm" className="flex-shrink-0" title="Ver archivo" aria-label={`Ver ${e.archivos.nombre_original}`} disabled={descarga.isPending} onClick={() => descarga.mutate(e)}>
                  <Download size={16} aria-hidden="true" />
                </Button>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      <EvidenciaNueva
        mostrar={mostrarNueva}
        permisoId={permisoId}
        momentoInicial={MOMENTO_SUGERIDO[estado]}
        alCerrar={() => setMostrarNueva(false)}
        alAgregada={() => {
          setMostrarNueva(false)
          setAgregada(true)
        }}
      />
    </section>
  )
}