import { useState } from 'react'
import { Alert, Badge, Button, Card } from 'react-bootstrap'
import { CalendarClock, CalendarX, Plus } from 'lucide-react'
import EstadoBadge from '../../componentes/EstadoBadge'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import { useSesion } from '../../sesion/contexto'
import { formatearDia, formatearFechaHora } from '../../utilidades/fechas'
import { DIAS_AVISO, diasParaVencer } from '../../utilidades/vencimiento'
import { useDocumentos } from './documentos.api'
import SubirDocumento from './SubirDocumento'
import type { Documento } from './tipos'

/** De quién es el documento, solo cuando no es del propio usuario (por ejemplo, al supervisor) */
function titularAjeno(d: Documento, miContratistaId: string | null): string | null {
  if (d.contratistas) return d.contratista_id === miContratistaId ? null : `${d.contratistas.nombres} ${d.contratistas.apellidos}`
  if (d.empresas_contratistas) return d.empresas_contratistas.razon_social
  if (d.equipos) return `Equipo ${d.equipos.codigo}`
  return null
}

/** Fecha de vencimiento con aviso. Es solo visual: la validez la decide el backend. */
function Vencimiento({ fecha }: { fecha: string | null }) {
  const dias = diasParaVencer(fecha)
  if (dias === null) return <span>Sin vencimiento</span>

  const vencido = dias < 0
  const aviso = !vencido && dias <= DIAS_AVISO
  const texto = dias === 0 ? 'Vence hoy' : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`

  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      <span className="numeros-tabulares">Vence: {formatearDia(fecha)}</span>
      {(vencido || aviso) && (
        <Badge
          bg={vencido ? 'danger-subtle' : 'warning-subtle'}
          text={vencido ? 'danger-emphasis' : 'warning-emphasis'}
          className="d-inline-flex align-items-center gap-1 fw-semibold"
        >
          {vencido ? <CalendarX size={13} aria-hidden="true" /> : <CalendarClock size={13} aria-hidden="true" />}
          {vencido ? 'Vencido' : texto}
        </Badge>
      )}
    </div>
  )
}

export default function DocumentosPagina() {
  const { perfil } = useSesion()
  // Subir exige ser un contratista (el supervisor no tiene ficha propia)
  const contratistaId = perfil?.contratista_id ?? null

  const consulta = useDocumentos()
  const [mostrarSubir, setMostrarSubir] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const documentos = consulta.data?.datos ?? []

  function abrirSubir() {
    setEnviado(false)
    setMostrarSubir(true)
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h5 mb-0">Mis documentos</h1>
        {contratistaId && (
          <Button className="d-inline-flex align-items-center gap-1" onClick={abrirSubir}>
            <Plus size={18} aria-hidden="true" /> Subir
          </Button>
        )}
      </div>

      {!contratistaId && (
        <Alert variant="info">Tu cuenta no está vinculada a un contratista, por eso no puedes subir documentos desde aquí.</Alert>
      )}

      {enviado && (
        <Alert variant="success" dismissible onClose={() => setEnviado(false)}>
          Documento enviado. Queda pendiente de revisión.
        </Alert>
      )}

      {consulta.isPending ? (
        <Cargando texto="Cargando tus documentos…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
      ) : documentos.length === 0 ? (
        <SinDatos
          titulo="Aún no tienes documentos"
          descripcion="Sube los documentos que te pida seguridad industrial para poder ingresar a la planta."
          accion={
            contratistaId ? (
              <Button size="sm" onClick={abrirSubir}>
                Subir documento
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="d-flex flex-column gap-3">
          {documentos.map((d) => {
            const titular = titularAjeno(d, contratistaId)
            return (
              <Card key={d.id}>
                <Card.Body>
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div className="text-break">
                      <div className="fw-semibold">{d.tipos_documento.nombre}</div>
                      <small className="numeros-tabulares">{d.numero ? `N.º ${d.numero}` : 'Sin número'}</small>
                      {titular && <div className="small">{titular}</div>}
                    </div>
                    <EstadoBadge entidad="revision" estado={d.estado_revision} />
                  </div>

                  <div className="mt-2">
                    <Vencimiento fecha={d.fecha_vencimiento} />
                  </div>

                  {d.estado_revision === 'rechazado' && d.observaciones && (
                    <Alert variant="danger" className="py-2 mt-2 mb-0 small text-break">
                      <strong>Motivo del rechazo:</strong> {d.observaciones}
                    </Alert>
                  )}

                  <div className="small mt-2 numeros-tabulares">
                    Enviado el {formatearFechaHora(d.created_at)}
                    {d.revisado_en ? ` · Revisado el ${formatearFechaHora(d.revisado_en)}` : ''}
                  </div>
                </Card.Body>
              </Card>
            )
          })}
        </div>
      )}

      {contratistaId && (
        <SubirDocumento
          mostrar={mostrarSubir}
          contratistaId={contratistaId}
          alCerrar={() => setMostrarSubir(false)}
          alEnviado={() => {
            setMostrarSubir(false)
            setEnviado(true)
          }}
        />
      )}
    </>
  )
}