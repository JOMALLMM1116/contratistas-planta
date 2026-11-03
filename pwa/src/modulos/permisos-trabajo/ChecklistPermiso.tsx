import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap'
import { Check, X } from 'lucide-react'
import { ErrorApi } from '../../api/cliente'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { useChecklist, useGuardarChecklist } from './permisos.api'
import type { ChecklistContratista, EstadoPermiso, ItemChecklist, RespuestaItem } from './tipos'

interface Respuesta {
  cumple: boolean | null
  observacion: string
}

const deItem = (i: ItemChecklist): Respuesta => ({ cumple: i.cumple, observacion: i.observacion ?? '' })

function BloqueChecklist({ bloque, editable, mio, permisoId }: { bloque: ChecklistContratista; editable: boolean; mio: boolean; permisoId: string }) {
  const guardar = useGuardarChecklist(permisoId)
  const [respuestas, setRespuestas] = useState<Record<number, Respuesta>>({})

  // Parte de lo guardado en el servidor y se reinicia cuando llega algo nuevo
  useEffect(() => {
    setRespuestas(Object.fromEntries(bloque.items.map((i) => [i.item_id, deItem(i)])))
  }, [bloque])

  const leer = (i: ItemChecklist): Respuesta => respuestas[i.item_id] ?? deItem(i)
  const cambiar = (i: ItemChecklist, parcial: Partial<Respuesta>) => setRespuestas((previas) => ({ ...previas, [i.item_id]: { ...leer(i), ...parcial } }))

  const modificado = bloque.items.some((i) => {
    const r = leer(i)
    return r.cumple !== i.cumple || r.observacion.trim() !== (i.observacion ?? '')
  })

  // Solo se envían los puntos que ya tienen respuesta
  const aEnviar: RespuestaItem[] = bloque.items.flatMap((i) => {
    const r = leer(i)
    return r.cumple === null ? [] : [{ contratista_id: bloque.contratista_id, item_id: i.item_id, cumple: r.cumple, observacion: r.observacion.trim() || null }]
  })

  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <span className="fw-semibold">{bloque.nombre}</span>
          {mio && (
            <Badge bg="secondary-subtle" text="secondary-emphasis">
              Tú
            </Badge>
          )}
          {bloque.pendientes > 0 ? (
            <Badge bg="warning-subtle" text="warning-emphasis">
              Faltan {bloque.pendientes} obligatorios
            </Badge>
          ) : (
            <Badge bg="success-subtle" text="success-emphasis">
              Completo
            </Badge>
          )}
        </div>

        <ul className="list-unstyled mb-0">
          {bloque.items.map((i) => {
            const r = leer(i)
            return (
              <li key={i.item_id} className="py-3 border-top">
                <div className="mb-2">
                  {i.descripcion}
                  {i.obligatorio && (
                    <Badge bg="info-subtle" text="info-emphasis" className="ms-2">
                      Obligatorio
                    </Badge>
                  )}
                </div>

                {editable ? (
                  <>
                    <div className="d-flex gap-2 mb-2">
                      <Button
                        variant={r.cumple === true ? 'success' : 'secondary'}
                        size="lg"
                        className="flex-fill d-inline-flex align-items-center justify-content-center gap-2"
                        aria-pressed={r.cumple === true}
                        disabled={guardar.isPending}
                        onClick={() => cambiar(i, { cumple: true })}
                      >
                        <Check size={18} aria-hidden="true" /> Cumple
                      </Button>
                      <Button
                        variant={r.cumple === false ? 'danger' : 'secondary'}
                        size="lg"
                        className="flex-fill d-inline-flex align-items-center justify-content-center gap-2"
                        aria-pressed={r.cumple === false}
                        disabled={guardar.isPending}
                        onClick={() => cambiar(i, { cumple: false })}
                      >
                        <X size={18} aria-hidden="true" /> No cumple
                      </Button>
                    </div>
                    <Form.Control
                      placeholder="Observación (opcional)"
                      aria-label={`Observación de: ${i.descripcion}`}
                      maxLength={500}
                      value={r.observacion}
                      onChange={(e) => cambiar(i, { observacion: e.target.value })}
                      disabled={guardar.isPending}
                    />
                  </>
                ) : (
                  <>
                    {i.cumple === true && (
                      <Badge bg="success-subtle" text="success-emphasis">
                        Cumple
                      </Badge>
                    )}
                    {i.cumple === false && (
                      <Badge bg="danger-subtle" text="danger-emphasis">
                        No cumple
                      </Badge>
                    )}
                    {i.cumple === null && (
                      <Badge bg="body-tertiary" text="body-emphasis" className="border">
                        Sin responder
                      </Badge>
                    )}
                    {i.observacion && <div className="small mt-1 text-break">{i.observacion}</div>}
                  </>
                )}
              </li>
            )
          })}
        </ul>

        {editable && (
          <>
            {guardar.isError && (
              <Alert variant="danger" className="py-2 mt-2 mb-2">
                {guardar.error instanceof ErrorApi ? guardar.error.message : 'No se pudo guardar. Intenta de nuevo.'}
              </Alert>
            )}
            {guardar.isSuccess && !modificado && (
              <Alert variant="success" className="py-2 mt-2 mb-2">
                Respuestas guardadas.
              </Alert>
            )}
            <Button
              size="lg"
              className="w-100 mt-2 d-inline-flex align-items-center justify-content-center gap-2"
              disabled={!modificado || aEnviar.length === 0 || guardar.isPending}
              onClick={() => guardar.mutate(aEnviar)}
            >
              {guardar.isPending && <Spinner animation="border" size="sm" />}
              Guardar respuestas
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  )
}

export default function ChecklistPermiso({ permisoId, estado }: { permisoId: string; estado: EstadoPermiso }) {
  const { perfil } = useSesion()
  const consulta = useChecklist(permisoId)
  const miId = perfil?.contratista_id ?? null

  // Se responde solo con permiso, y mientras el permiso esté emitido o en ejecución
  const puedeResponder = tienePermiso(perfil, 'checklist.completar') && (estado === 'emitido' || estado === 'en_ejecucion')

  return (
    <section className="mb-4" aria-labelledby="titulo-checklist">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <h2 className="h6 mb-0" id="titulo-checklist">
          Checklist de seguridad
        </h2>
        {consulta.data && consulta.data.total_items > 0 && (
          <Badge bg={consulta.data.completo ? 'success-subtle' : 'warning-subtle'} text={consulta.data.completo ? 'success-emphasis' : 'warning-emphasis'}>
            {consulta.data.completo ? 'Completo' : 'Incompleto'}
          </Badge>
        )}
      </div>

      {consulta.isPending ? (
        <Cargando texto="Cargando el checklist…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
      ) : consulta.data.total_items === 0 ? (
        <Card body>Este tipo de trabajo no tiene puntos de checklist.</Card>
      ) : (
        [...consulta.data.contratistas]
          .sort((a, b) => Number(b.contratista_id === miId) - Number(a.contratista_id === miId))
          .map((bloque) => (
            // Cada persona responde su propio checklist; quien no tiene ficha de contratista (supervisor) puede responder el de todos
            <BloqueChecklist key={bloque.contratista_id} bloque={bloque} mio={bloque.contratista_id === miId} editable={puedeResponder && (miId === null || bloque.contratista_id === miId)} permisoId={permisoId} />
          ))
      )}
    </section>
  )
}