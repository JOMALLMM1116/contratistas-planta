import { useState } from 'react'
import { Alert, Button, Modal, Spinner } from 'react-bootstrap'
import { Printer } from 'lucide-react'
import EstadoBadge from '../../componentes/EstadoBadge'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { ErrorApi } from '../../api/cliente'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { formatearFechaHora } from '../../utilidades/fechas'
import { descargarPase, useQrCredencial } from './credenciales.api'
import { textoUsos, type CredencialConQr } from './tipos'

const PREFIJO_QR = 'data:image/png;base64,'

interface Props {
  /** null = diálogo cerrado */
  credencialId: string | null
  nombreContratista: string
  /** Si se acaba de emitir, ya trae el QR y no hace falta pedirlo */
  inicial?: CredencialConQr | null
  alCerrar: () => void
}

export default function ModalQr({ credencialId, nombreContratista, inicial, alCerrar }: Props) {
  const { perfil } = useSesion()
  const consulta = useQrCredencial(inicial ? null : credencialId)
  const datos = inicial ?? consulta.data
  const [descargando, setDescargando] = useState(false)
  const [errorPase, setErrorPase] = useState<string | null>(null)

  // Solo se acepta una imagen PNG incrustada: nunca una dirección externa
  const qrValido = !!datos?.qr && datos.qr.startsWith(PREFIJO_QR)

  async function imprimir() {
    if (!datos) return
    setErrorPase(null)
    setDescargando(true)
    try {
      await descargarPase(datos)
    } catch (error) {
      setErrorPase(error instanceof ErrorApi ? error.message : 'No se pudo generar el pase.')
    } finally {
      setDescargando(false)
    }
  }

  function cerrar() {
    setErrorPase(null)
    alCerrar()
  }

  return (
    <Modal show={credencialId !== null} onHide={cerrar} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Credencial de {nombreContratista}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {!inicial && consulta.isPending ? (
          <Cargando texto="Generando QR…" />
        ) : !inicial && consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : datos ? (
          <div className="text-center">
            {qrValido ? (
              // Fondo blanco siempre: el lector necesita contraste aunque la app esté en tema oscuro
              <img
                src={datos.qr}
                alt={`Código QR de la credencial ${datos.codigo_corto}`}
                className="img-fluid bg-white p-2 rounded border"
                style={{ maxWidth: 280 }}
              />
            ) : (
              <Alert variant="warning">El código QR no está disponible.</Alert>
            )}

            <div className="small text-body-secondary mt-3">Código para escribir a mano</div>
            <div className="fs-2 fw-semibold numeros-tabulares" style={{ letterSpacing: '0.15em' }}>
              {datos.codigo_corto}
            </div>

            <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mt-2 small">
              <EstadoBadge entidad="credencial" estado={datos.estado_efectivo} />
              <span>Vence: {formatearFechaHora(datos.expira_en)}</span>
              <span>Usos: {textoUsos(datos)}</span>
            </div>
          </div>
        ) : null}

        {errorPase && (
          <Alert variant="danger" className="py-2 mt-3 mb-0">
            {errorPase}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        {datos && tienePermiso(perfil, 'garita.imprimir_pase') && (
          <Button
            variant="outline-primary"
            className="d-inline-flex align-items-center gap-2"
            onClick={() => void imprimir()}
            disabled={descargando}
          >
            {descargando ? <Spinner animation="border" size="sm" /> : <Printer size={16} />}
            Imprimir pase
          </Button>
        )}
        <Button onClick={cerrar}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  )
}
