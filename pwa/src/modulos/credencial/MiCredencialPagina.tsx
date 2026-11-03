import { useState } from 'react'
import { Badge, Button, Card, Spinner } from 'react-bootstrap'
import { QrCode } from 'lucide-react'
import EstadoBadge from '../../componentes/EstadoBadge'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import { formatearFechaHora } from '../../utilidades/fechas'
import { useMisCredenciales, useSolicitudDeCredencial } from './credencial.api'
import { textoUsos, type Credencial } from './tipos'
import QrPantallaCompleta from './QrPantallaCompleta'

/** Tarjeta de una credencial activa con los datos de su solicitud */
function TarjetaCredencial({ credencial, alMostrarQr }: { credencial: Credencial; alMostrarQr: () => void }) {
  const solicitud = useSolicitudDeCredencial(credencial.solicitud_id)

  return (
    <Card className="shadow-sm mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div>
            <div className="small text-body-secondary">Credencial</div>
            <div className="fs-4 fw-semibold numeros-tabulares" style={{ letterSpacing: '0.1em' }}>
              {credencial.codigo_corto}
            </div>
          </div>
          <EstadoBadge entidad="credencial" estado={credencial.estado_efectivo} />
        </div>

        {solicitud.isPending ? (
          <Spinner animation="border" size="sm" />
        ) : solicitud.data ? (
          <div className="mb-2">
            <div className="fw-semibold">{solicitud.data.codigo}</div>
            <div className="small text-body-secondary">{solicitud.data.descripcion_actividad}</div>
            <div className="d-flex flex-wrap gap-1 mt-2">
              {solicitud.data.solicitud_zonas.map(({ zonas: z }) => (
                <Badge key={z.id} bg="body-tertiary" text="body-secondary" className="border" title={z.nombre}>
                  {z.codigo}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        <div className="small mb-3">
          Vence: {formatearFechaHora(credencial.expira_en)} · Usos: {textoUsos(credencial)}
        </div>

        <Button size="lg" className="w-100 d-flex align-items-center justify-content-center gap-2" onClick={alMostrarQr}>
          <QrCode size={22} aria-hidden="true" /> Mostrar QR
        </Button>
      </Card.Body>
    </Card>
  )
}

export default function MiCredencialPagina() {
  const credenciales = useMisCredenciales()
  const [qrAbierto, setQrAbierto] = useState<string | null>(null)

  if (credenciales.isPending) return <Cargando />
  if (credenciales.isError) return <ErrorCarga error={credenciales.error} alReintentar={() => void credenciales.refetch()} />

  // Solo las vigentes: el backend calcula estado_efectivo (vencida, revocada, usada...)
  const activas = credenciales.data.filter((c) => c.estado_efectivo === 'activa')

  return (
    <>
      <h1 className="h5 mb-3">Mi credencial</h1>

      {activas.length === 0 ? (
        <SinDatos titulo="No tienes una credencial activa" descripcion="Cuando se apruebe tu solicitud y se emita tu credencial, aparecerá aquí." />
      ) : (
        activas.map((c) => <TarjetaCredencial key={c.id} credencial={c} alMostrarQr={() => setQrAbierto(c.id)} />)
      )}

      <QrPantallaCompleta credencialId={qrAbierto} alCerrar={() => setQrAbierto(null)} />
    </>
  )
}
