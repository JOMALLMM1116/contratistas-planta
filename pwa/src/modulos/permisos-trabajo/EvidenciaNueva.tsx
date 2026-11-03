import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'
import { Camera, FileUp, X } from 'lucide-react'
import { ErrorApi } from '../../api/cliente'
import { problemaDeArchivo, tamano, TEXTO_MOMENTO } from './ayudas'
import { useAgregarEvidencia } from './permisos.api'
import type { MomentoEvidencia } from './tipos'

interface Props {
  mostrar: boolean
  permisoId: string
  momentoInicial: MomentoEvidencia
  alCerrar: () => void
  alAgregada: () => void
}

export default function EvidenciaNueva({ mostrar, permisoId, momentoInicial, alCerrar, alAgregada }: Props) {
  const agregar = useAgregarEvidencia(permisoId)
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)

  const [momento, setMomento] = useState<MomentoEvidencia>(momentoInicial)
  const [descripcion, setDescripcion] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza limpio
  useEffect(() => {
    if (!mostrar) return
    setMomento(momentoInicial)
    setDescripcion('')
    setArchivo(null)
    setErrorArchivo(null)
    setIntentado(false)
    agregar.olvidarArchivo()
    agregar.reset()
  }, [mostrar])

  const mensajeArchivo = errorArchivo ?? (intentado && !archivo ? 'Toma una foto o elige un archivo.' : undefined)

  function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0]
    evento.target.value = '' // permite volver a elegir el mismo archivo
    if (!elegido) return
    const problema = problemaDeArchivo(elegido)
    setArchivo(problema ? null : elegido)
    setErrorArchivo(problema)
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (!archivo) return
    agregar.mutate({ archivo, momento, descripcion: descripcion.trim() }, { onSuccess: alAgregada })
  }

  const enCurso = agregar.isPending
  const textoEnviar = agregar.paso === 'archivo' ? 'Subiendo archivo…' : agregar.paso === 'evidencia' ? 'Guardando evidencia…' : 'Agregar evidencia'

  return (
    <Modal show={mostrar} onHide={enCurso ? undefined : alCerrar} backdrop={enCurso ? 'static' : true} fullscreen="sm-down" centered scrollable>
      <Form onSubmit={enviar} noValidate>
        <Modal.Header closeButton={!enCurso}>
          <Modal.Title as="h2" className="h5">
            Agregar evidencia
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-3" controlId="evid-momento">
            <Form.Label>Momento</Form.Label>
            <Form.Select size="lg" value={momento} onChange={(e) => setMomento(e.target.value as MomentoEvidencia)} disabled={enCurso}>
              {(Object.keys(TEXTO_MOMENTO) as MomentoEvidencia[]).map((m) => (
                <option key={m} value={m}>
                  {TEXTO_MOMENTO[m]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-4" controlId="evid-descripcion">
            <Form.Label>Descripción (opcional)</Form.Label>
            <Form.Control as="textarea" rows={2} maxLength={500} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={enCurso} />
          </Form.Group>

          <div className="form-label">
            Archivo<span className="text-danger"> *</span>
          </div>
          <div className="d-grid gap-2">
            <Button variant="primary" size="lg" className="d-inline-flex align-items-center justify-content-center gap-2" disabled={enCurso} onClick={() => camara.current?.click()}>
              <Camera size={20} aria-hidden="true" /> Tomar foto
            </Button>
            <Button variant="secondary" size="lg" className="d-inline-flex align-items-center justify-content-center gap-2" disabled={enCurso} onClick={() => galeria.current?.click()}>
              <FileUp size={20} aria-hidden="true" /> Elegir archivo (PDF o imagen)
            </Button>
          </div>
          {/* La cámara solo ofrece imágenes; "Elegir archivo" admite también PDF */}
          <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={alElegir} />
          <input ref={galeria} type="file" accept="application/pdf,image/*" hidden onChange={alElegir} />

          {archivo && (
            <div className="d-flex align-items-center justify-content-between gap-2 border rounded px-3 py-2 mt-2">
              <div className="text-break">
                <div className="fw-semibold">{archivo.name}</div>
                <small>{tamano(archivo.size)}</small>
              </div>
              <Button variant="secondary" size="sm" title="Quitar archivo" aria-label="Quitar archivo" disabled={enCurso} onClick={() => setArchivo(null)}>
                <X size={16} aria-hidden="true" />
              </Button>
            </div>
          )}
          {mensajeArchivo && (
            <div className="text-danger small mt-1" role="alert">
              {mensajeArchivo}
            </div>
          )}

          {agregar.isError && (
            <Alert variant="danger" className="mt-3 mb-0">
              {agregar.error instanceof ErrorApi ? agregar.error.message : 'No se pudo enviar la evidencia. Intenta de nuevo.'}
              {agregar.yaSubido(archivo) && <div className="small mt-1">El archivo ya se subió: al reintentar solo se guardará la evidencia.</div>}
            </Alert>
          )}
        </Modal.Body>

        <Modal.Footer className="flex-nowrap">
          <Button variant="secondary" onClick={alCerrar} disabled={enCurso}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={enCurso} className="flex-grow-1 d-inline-flex align-items-center justify-content-center gap-2">
            {enCurso && <Spinner animation="border" size="sm" />}
            {textoEnviar}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}