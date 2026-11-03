import { useEffect, useRef, useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import { Camera, CameraOff } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'

const ID_LECTOR = 'lector-qr-garita'
// Si la cámara sigue viendo el mismo QR, no se vuelve a enviar durante este tiempo
const PAUSA_MISMA_LECTURA_MS = 4000

interface Props {
  alLeer: (texto: string) => void
}

/** Cámara para leer el QR de la credencial (necesita HTTPS o localhost) */
export default function LectorQr({ alLeer }: Props) {
  const [activo, setActivo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alLeerRef = useRef(alLeer)
  const ultima = useRef<{ texto: string; momento: number } | null>(null)

  useEffect(() => {
    alLeerRef.current = alLeer
  }, [alLeer])

  useEffect(() => {
    if (!activo) return
    const lector = new Html5Qrcode(ID_LECTOR)
    let cancelado = false

    lector
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texto) => {
          const ahora = Date.now()
          if (ultima.current && ultima.current.texto === texto && ahora - ultima.current.momento < PAUSA_MISMA_LECTURA_MS) return
          ultima.current = { texto, momento: ahora }
          alLeerRef.current(texto)
        },
        () => {
          // Fotograma sin QR: es normal, no se hace nada
        },
      )
      .catch(() => {
        if (!cancelado) {
          setError('No se pudo abrir la cámara. Revisa el permiso del navegador o usa el campo de código.')
          setActivo(false)
        }
      })

    return () => {
      cancelado = true
      if (lector.isScanning) {
        void lector
          .stop()
          .then(() => lector.clear())
          .catch(() => {})
      }
    }
  }, [activo])

  return (
    <div>
      <div id={ID_LECTOR} className={activo ? 'rounded overflow-hidden border mb-2' : 'd-none'} />
      {error && (
        <Alert variant="warning" className="py-2">
          {error}
        </Alert>
      )}
      <Button
        variant={activo ? 'outline-secondary' : 'outline-primary'}
        className="d-inline-flex align-items-center gap-2"
        onClick={() => {
          setError(null)
          setActivo((v) => !v)
        }}
      >
        {activo ? <CameraOff size={18} /> : <Camera size={18} />}
        {activo ? 'Detener cámara' : 'Usar cámara'}
      </Button>
    </div>
  )
}
