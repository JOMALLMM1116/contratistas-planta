import { useEffect } from 'react'
import { Alert, Button, Modal } from 'react-bootstrap'
import { X } from 'lucide-react'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { useSesion } from '../../sesion/contexto'
import { formatearFechaHora } from '../../utilidades/fechas'
import { useQrPropio } from './credencial.api'
import { textoUsos } from './tipos'

const PREFIJO_QR = 'data:image/png;base64,'

interface Props {
  /** null = cerrado */
  credencialId: string | null
  alCerrar: () => void
}

/** QR a pantalla completa para mostrar en garita */
export default function QrPantallaCompleta({ credencialId, alCerrar }: Props) {
  const { perfil } = useSesion()
  const consulta = useQrPropio(credencialId)
  const datos = consulta.data
  // Solo se acepta una imagen PNG incrustada: nunca una dirección externa
  const qrValido = !!datos?.qr && datos.qr.startsWith(PREFIJO_QR)

  // Mientras el QR está abierto, se pide que la pantalla no se apague (si el navegador lo permite)
  useEffect(() => {
    if (credencialId === null || !('wakeLock' in navigator)) return
    let bloqueo: WakeLockSentinel | null = null
    navigator.wakeLock
      .request('screen')
      .then((b) => {
        bloqueo = b
      })
      .catch(() => {
        // Sin permiso o sin soporte: la pantalla se comporta normal
      })
    return () => {
      void bloqueo?.release()
    }
  }, [credencialId])

  return (
    <Modal show={credencialId !== null} onHide={alCerrar} fullscreen>
      <Modal.Body className="d-flex flex-column align-items-center justify-content-center text-center p-3">
        {consulta.isPending ? (
          <Cargando texto="Generando QR…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : datos ? (
          <>
            <div className="fw-semibold mb-3">{perfil?.nombre_completo}</div>

            {qrValido ? (
              // Fondo blanco siempre: el lector de garita necesita contraste aunque la app esté en oscuro
              <img
                src={datos.qr}
                alt={`Código QR de la credencial ${datos.codigo_corto}`}
                className="bg-white p-3 rounded border"
                style={{ width: 'min(85vw, 360px)', height: 'auto' }}
              />
            ) : (
              <Alert variant="warning">El código QR no está disponible.</Alert>
            )}

            <div className="small text-body-secondary mt-4">Código para escribir a mano</div>
            <div className="fs-1 fw-semibold numeros-tabulares" style={{ letterSpacing: '0.15em' }}>
              {datos.codigo_corto}
            </div>
            <div className="small mt-2">
              Vence: {formatearFechaHora(datos.expira_en)} · Usos: {textoUsos(datos)}
            </div>
          </>
        ) : null}

        <Button
          variant="outline-secondary"
          size="lg"
          className="mt-4 d-inline-flex align-items-center gap-2"
          onClick={alCerrar}
        >
          <X size={20} aria-hidden="true" /> Cerrar
        </Button>
      </Modal.Body>
    </Modal>
  )
}
