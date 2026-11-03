import type { ReactNode } from 'react'
import { Alert, Button, Spinner } from 'react-bootstrap'
import type { LucideIcon } from 'lucide-react'
import { CalendarX, CheckCheck, Clock, LogIn, Lock, MapPin, ScanLine, ShieldAlert, ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react'
import { formatearFechaHora } from '../../utilidades/fechas'
import type { RespuestaValidacion } from './tipos'

type Variante = 'success' | 'danger' | 'warning'

const RESULTADOS: Record<string, { titulo: string; variante: Variante; icono: LucideIcon }> = {
  valido: { titulo: 'ACCESO PERMITIDO', variante: 'success', icono: ShieldCheck },
  vencido: { titulo: 'Credencial vencida', variante: 'danger', icono: CalendarX },
  revocado: { titulo: 'Credencial revocada', variante: 'danger', icono: ShieldOff },
  usado: { titulo: 'Credencial ya utilizada', variante: 'danger', icono: CheckCheck },
  invalido: { titulo: 'Código no válido', variante: 'danger', icono: ScanLine },
  bloqueado: { titulo: 'Persona o empresa bloqueada', variante: 'danger', icono: Lock },
  documentos_vencidos: { titulo: 'Documentos vencidos', variante: 'danger', icono: TriangleAlert },
  fuera_de_horario: { titulo: 'Fuera del horario autorizado', variante: 'warning', icono: Clock },
  zona_no_autorizada: { titulo: 'Zona no autorizada', variante: 'warning', icono: MapPin },
}
// Cualquier resultado desconocido se muestra como NO autorizado
const DESCONOCIDO = { titulo: 'Acceso no autorizado', variante: 'danger' as Variante, icono: ShieldAlert }

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <div className="small opacity-75">{etiqueta}</div>
      <div className="fw-semibold">{children}</div>
    </div>
  )
}

interface Props {
  resultado: RespuestaValidacion
  entradaRegistrada: boolean
  puedeRegistrar: boolean
  registrando: boolean
  errorEntrada?: string | null
  alRegistrar: () => void
}

export default function PanelResultado({ resultado, entradaRegistrada, puedeRegistrar, registrando, errorEntrada, alRegistrar }: Props) {
  const info = RESULTADOS[resultado.resultado] ?? DESCONOCIDO
  const Icono = info.icono
  const c = resultado.credencial

  return (
    <div className={`rounded-3 border border-2 border-${info.variante} bg-${info.variante}-subtle text-${info.variante}-emphasis p-4`} role="status">
      <div className="d-flex align-items-center gap-3 mb-2">
        <Icono size={44} aria-hidden="true" />
        <div className="fs-3 fw-bold lh-sm">{entradaRegistrada ? 'ENTRADA REGISTRADA' : info.titulo}</div>
      </div>
      <p className="fs-5 mb-3">{resultado.motivo}</p>

      {(resultado.contratista || resultado.solicitud) && (
        <div className="row g-3 mb-3">
          {resultado.contratista && (
            <div className="col-sm-6">
              <Dato etiqueta="Persona">
                {resultado.contratista.nombres} {resultado.contratista.apellidos}
                <div className="small fw-normal numeros-tabulares">Doc. {resultado.contratista.documento_identidad}</div>
              </Dato>
            </div>
          )}
          {resultado.empresa && (
            <div className="col-sm-6">
              <Dato etiqueta="Empresa">{resultado.empresa.razon_social}</Dato>
            </div>
          )}
          {resultado.solicitud && (
            <div className="col-sm-6">
              <Dato etiqueta="Solicitud">
                {resultado.solicitud.codigo}
                <div className="small fw-normal">{resultado.solicitud.descripcion_actividad}</div>
              </Dato>
            </div>
          )}
          {c && (
            <div className="col-sm-6">
              <Dato etiqueta="Credencial">
                <span className="numeros-tabulares">{c.codigo_corto}</span>
                <div className="small fw-normal">
                  Vence {formatearFechaHora(c.expira_en)} · Usos{' '}
                  {c.usos_maximos === null ? `${c.usos_actuales} (ilimitado)` : `${c.usos_actuales} de ${c.usos_maximos}`}
                </div>
              </Dato>
            </div>
          )}
          {resultado.zona && (
            <div className="col-sm-6">
              <Dato etiqueta="Zona">
                {resultado.zona.codigo} {resultado.zona.nombre}
              </Dato>
            </div>
          )}
        </div>
      )}

      {errorEntrada && (
        <Alert variant="danger" className="py-2">
          {errorEntrada}
        </Alert>
      )}

      {resultado.permitido && !entradaRegistrada && puedeRegistrar && (
        <Button
          size="lg"
          variant="success"
          className="w-100 d-inline-flex align-items-center justify-content-center gap-2"
          onClick={alRegistrar}
          disabled={registrando}
        >
          {registrando ? <Spinner animation="border" size="sm" /> : <LogIn size={22} />}
          Registrar entrada
        </Button>
      )}
    </div>
  )
}
