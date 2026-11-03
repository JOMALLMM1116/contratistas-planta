import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, Card } from 'react-bootstrap'
import { ArrowLeft, CirclePlay, SquareCheck } from 'lucide-react'
import { ErrorApi } from '../../api/cliente'
import EstadoBadge from '../../componentes/EstadoBadge'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { formatearDia, formatearFechaHora } from '../../utilidades/fechas'
import { hora } from './ayudas'
import ChecklistPermiso from './ChecklistPermiso'
import ConfirmarModal from './ConfirmarModal'
import EvidenciasPermiso from './EvidenciasPermiso'
import { useAccionesPermiso, usePermiso } from './permisos.api'

const textoError = (error: unknown) => (error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null)

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="small fw-semibold">{etiqueta}</div>
      <div className="text-break">{children}</div>
    </div>
  )
}

function Volver({ a, texto }: { a: string; texto: string }) {
  return (
    <Link to={a} className="d-inline-flex align-items-center gap-1 mb-3">
      <ArrowLeft size={16} aria-hidden="true" /> {texto}
    </Link>
  )
}

export default function PermisoPagina() {
  const { id = '' } = useParams()
  const { perfil } = useSesion()
  const consulta = usePermiso(id)
  const acciones = useAccionesPermiso(id)
  const [confirmando, setConfirmando] = useState<'iniciar' | 'cerrar' | null>(null)

  if (consulta.isPending) {
    return (
      <>
        <Volver a="/solicitudes" texto="Solicitudes" />
        <Cargando texto="Cargando el permiso…" />
      </>
    )
  }
  if (consulta.isError) {
    return (
      <>
        <Volver a="/solicitudes" texto="Solicitudes" />
        <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
      </>
    )
  }

  const p = consulta.data
  const sol = p.solicitudes_acceso
  // Iniciar y cerrar exigen actividad.confirmar; el servidor vuelve a validar todo
  const puedeConfirmar = tienePermiso(perfil, 'actividad.confirmar')
  const accionActual = confirmando === 'cerrar' ? acciones.cerrar : acciones.iniciar

  function abrir(tipo: 'iniciar' | 'cerrar') {
    acciones.iniciar.reset()
    acciones.cerrar.reset()
    setConfirmando(tipo)
  }

  function confirmar(texto: string) {
    const alTerminar = { onSuccess: () => setConfirmando(null) }
    if (confirmando === 'iniciar') acciones.iniciar.mutate(undefined, alTerminar)
    else acciones.cerrar.mutate(texto || undefined, alTerminar)
  }

  return (
    <>
      <Volver a={`/solicitudes/${p.solicitud_id}`} texto={`Solicitud ${sol.codigo}`} />

      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <h1 className="h4 mb-0 numeros-tabulares">{p.codigo}</h1>
        <EstadoBadge entidad="permiso_trabajo" estado={p.estado} />
      </div>
      <p className="mb-3">{sol.empresas_contratistas.razon_social}</p>

      {p.estado === 'revocado' && (
        <Alert variant="danger">
          <strong>Permiso revocado.</strong> {p.motivo_revocacion ?? ''}
        </Alert>
      )}
      {p.estado === 'vencido' && <Alert variant="warning">Este permiso venció sin usarse.</Alert>}
      {p.estado === 'emitido' && !p.vigente && (
        <Alert variant="warning">Este permiso está fuera de su fecha u horario de vigencia, así que el servidor no permitirá iniciar la actividad.</Alert>
      )}

      <Card className="mb-4">
        <Card.Body className="pb-1">
          <Dato etiqueta="Tipo de trabajo">{sol.tipos_trabajo.nombre}</Dato>
          <Dato etiqueta="Actividad">{sol.descripcion_actividad}</Dato>
          <Dato etiqueta="Vigencia">
            <span className="numeros-tabulares">
              {formatearDia(p.fecha_inicio)} – {formatearDia(p.fecha_fin)}
            </span>
            <div className="small numeros-tabulares">
              Horario: {hora(p.hora_inicio)} – {hora(p.hora_fin)}
            </div>
          </Dato>
          {p.condiciones_especiales && <Dato etiqueta="Condiciones especiales">{p.condiciones_especiales}</Dato>}
          {p.actividad_inicio_en && (
            <Dato etiqueta="Actividad iniciada">
              <span className="numeros-tabulares">{formatearFechaHora(p.actividad_inicio_en)}</span>
            </Dato>
          )}
          {p.actividad_fin_en && (
            <Dato etiqueta="Actividad finalizada">
              <span className="numeros-tabulares">{formatearFechaHora(p.actividad_fin_en)}</span>
            </Dato>
          )}
        </Card.Body>
      </Card>

      {puedeConfirmar && p.estado === 'emitido' && (
        <Button variant="success" size="lg" className="w-100 mb-4 d-inline-flex align-items-center justify-content-center gap-2" onClick={() => abrir('iniciar')}>
          <CirclePlay size={20} aria-hidden="true" /> Iniciar actividad
        </Button>
      )}
      {puedeConfirmar && p.estado === 'en_ejecucion' && (
        <Button variant="primary" size="lg" className="w-100 mb-4 d-inline-flex align-items-center justify-content-center gap-2" onClick={() => abrir('cerrar')}>
          <SquareCheck size={20} aria-hidden="true" /> Cerrar actividad
        </Button>
      )}

      <ChecklistPermiso permisoId={id} estado={p.estado} />
      <EvidenciasPermiso permisoId={id} estado={p.estado} />

      <ConfirmarModal
        mostrar={confirmando !== null}
        titulo={confirmando === 'cerrar' ? 'Cerrar actividad' : 'Iniciar actividad'}
        mensaje={
          confirmando === 'cerrar' ? (
            <>La actividad del permiso <strong>{p.codigo}</strong> quedará finalizada y el permiso pasará a «Cerrado».</>
          ) : (
            <>Se iniciará la actividad del permiso <strong>{p.codigo}</strong>. El servidor comprueba que esté vigente, que nadie esté bloqueado y que el checklist esté completo.</>
          )
        }
        textoConfirmar={confirmando === 'cerrar' ? 'Cerrar actividad' : 'Iniciar actividad'}
        variante={confirmando === 'cerrar' ? 'primary' : 'success'}
        etiquetaTexto={confirmando === 'cerrar' ? 'Observaciones del cierre' : undefined}
        procesando={accionActual.isPending}
        error={textoError(accionActual.error)}
        alConfirmar={confirmar}
        alCancelar={() => setConfirmando(null)}
      />
    </>
  )
}