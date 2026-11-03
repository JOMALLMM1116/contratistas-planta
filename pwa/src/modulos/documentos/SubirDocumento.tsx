import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'
import { Camera, FileUp, X } from 'lucide-react'
import { ErrorApi } from '../../api/cliente'
import { hoyGuatemala } from '../../utilidades/fechas'
import { useSubirDocumento, useTiposDocumento } from './documentos.api'

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_BYTES = 10 * 1024 * 1024

/** El servidor valida de nuevo (incluida la firma real del archivo); esto solo evita enviar de más */
function problemaDeArchivo(f: File): string | null {
  const tipoValido = TIPOS_PERMITIDOS.includes(f.type) || (f.type === '' && /\.(pdf|jpe?g|png)$/i.test(f.name))
  if (!tipoValido) return 'El archivo debe ser PDF, JPG o PNG.'
  if (f.size === 0) return 'El archivo está vacío.'
  if (f.size > MAX_BYTES) return 'El archivo pesa más de 10 MB.'
  return null
}

function tamano(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

interface Props {
  mostrar: boolean
  contratistaId: string
  alCerrar: () => void
  alEnviado: () => void
}

export default function SubirDocumento({ mostrar, contratistaId, alCerrar, alEnviado }: Props) {
  const tipos = useTiposDocumento(mostrar)
  const subir = useSubirDocumento()
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)

  const [tipoId, setTipoId] = useState('')
  const [numero, setNumero] = useState('')
  const [emision, setEmision] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza limpio
  useEffect(() => {
    if (!mostrar) return
    setTipoId('')
    setNumero('')
    setEmision('')
    setVencimiento('')
    setArchivo(null)
    setErrorArchivo(null)
    setIntentado(false)
    subir.olvidarArchivo()
    subir.reset()
  }, [mostrar])

  const tipo = (tipos.data ?? []).find((t) => String(t.id) === tipoId)
  const exigeVencimiento = tipo?.requiere_vencimiento ?? false

  const errores = {
    tipo: tipo ? undefined : 'Selecciona el tipo de documento.',
    archivo: archivo ? undefined : (errorArchivo ?? 'Toma una foto o elige un archivo.'),
    vencimiento:
      exigeVencimiento && !vencimiento
        ? 'Este tipo de documento exige fecha de vencimiento.'
        : emision && vencimiento && vencimiento < emision
          ? 'El vencimiento no puede ser anterior a la emisión.'
          : undefined,
  }
  const hayErrores = Object.values(errores).some(Boolean)
  const ver = (clave: 'tipo' | 'vencimiento') => (intentado ? errores[clave] : undefined)
  // Un archivo inválido se avisa de inmediato; el faltante, hasta intentar enviar
  const mensajeArchivo = errorArchivo ?? (intentado ? errores.archivo : undefined)

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
    if (hayErrores || !archivo || !tipo) return

    subir.mutate(
      {
        archivo,
        contratistaId,
        datos: {
          tipo_documento_id: tipo.id,
          ...(numero.trim() ? { numero: numero.trim() } : {}),
          ...(emision ? { fecha_emision: emision } : {}),
          ...(vencimiento ? { fecha_vencimiento: vencimiento } : {}),
        },
      },
      { onSuccess: alEnviado },
    )
  }

  const enCurso = subir.isPending
  const textoEnviar = subir.paso === 'archivo' ? 'Subiendo archivo…' : subir.paso === 'documento' ? 'Guardando documento…' : 'Enviar documento'

  return (
    <Modal show={mostrar} onHide={enCurso ? undefined : alCerrar} backdrop={enCurso ? 'static' : true} fullscreen="sm-down" centered>
      <Form onSubmit={enviar} noValidate>
        <Modal.Header closeButton={!enCurso}>
          <Modal.Title as="h2" className="h5">
            Subir documento
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-3" controlId="doc-tipo">
            <Form.Label>
              Tipo de documento<span className="text-danger"> *</span>
            </Form.Label>
            <Form.Select size="lg" value={tipoId} onChange={(e) => setTipoId(e.target.value)} isInvalid={!!ver('tipo')} disabled={enCurso || tipos.isPending}>
              <option value="">{tipos.isPending ? 'Cargando…' : 'Selecciona…'}</option>
              {(tipos.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">{ver('tipo')}</Form.Control.Feedback>
            {tipos.isError && <div className="text-danger small mt-1">No se pudieron cargar los tipos de documento.</div>}
          </Form.Group>

          <Form.Group className="mb-3" controlId="doc-numero">
            <Form.Label>Número del documento (opcional)</Form.Label>
            <Form.Control size="lg" maxLength={60} value={numero} onChange={(e) => setNumero(e.target.value)} disabled={enCurso} />
          </Form.Group>

          <Form.Group className="mb-3" controlId="doc-emision">
            <Form.Label>Fecha de emisión (opcional)</Form.Label>
            <Form.Control size="lg" type="date" max={hoyGuatemala()} value={emision} onChange={(e) => setEmision(e.target.value)} disabled={enCurso} />
          </Form.Group>

          <Form.Group className="mb-4" controlId="doc-vencimiento">
            <Form.Label>
              Fecha de vencimiento{exigeVencimiento && <span className="text-danger"> *</span>}
            </Form.Label>
            <Form.Control
              size="lg"
              type="date"
              min={emision || undefined}
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
              isInvalid={!!ver('vencimiento')}
              disabled={enCurso}
            />
            <Form.Control.Feedback type="invalid">{ver('vencimiento')}</Form.Control.Feedback>
            {!exigeVencimiento && tipo && <Form.Text>Déjala vacía si el documento no vence.</Form.Text>}
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

          {subir.isError && (
            <Alert variant="danger" className="mt-3 mb-0">
              {subir.error instanceof ErrorApi ? subir.error.message : 'No se pudo enviar el documento. Intenta de nuevo.'}
              {subir.yaSubido(archivo) && <div className="small mt-1">El archivo ya se subió: al reintentar solo se guardará el documento.</div>}
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