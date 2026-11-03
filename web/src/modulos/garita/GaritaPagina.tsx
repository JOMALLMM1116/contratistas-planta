import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, Card, Col, Form, InputGroup, Row, Spinner } from 'react-bootstrap'
import { ScanLine, Search } from 'lucide-react'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { ErrorApi } from '../../api/cliente'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { armarIdentificador, useEntrada, useValidar, useZonasGarita } from './garita.api'
import type { Identificador, RespuestaValidacion } from './tipos'
import LectorQr from './LectorQr'
import PanelResultado from './PanelResultado'

// La zona es una preferencia del puesto de garita: se recuerda en este navegador
const CLAVE_ZONA = 'cp_garita_zona'
const LIMPIAR_TRAS_ENTRADA_MS = 6000

function leerZonaGuardada(): number | null {
  try {
    const valor = Number(localStorage.getItem(CLAVE_ZONA))
    return Number.isInteger(valor) && valor > 0 ? valor : null
  } catch {
    return null
  }
}

function mensaje(error: unknown): string {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación.'
}

export default function GaritaPagina() {
  const { perfil } = useSesion()
  const puedeRegistrar = tienePermiso(perfil, 'garita.registrar_acceso')

  const zonas = useZonasGarita()
  const validar = useValidar()
  const entrada = useEntrada()

  const [zonaId, setZonaId] = useState<number | null>(leerZonaGuardada)
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [resultado, setResultado] = useState<RespuestaValidacion | null>(null)
  const [identificador, setIdentificador] = useState<Identificador | null>(null)
  const [entradaRegistrada, setEntradaRegistrada] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  const zona = zonas.data?.find((z) => z.id === zonaId) ?? zonas.data?.[0] ?? null

  function enfocar() {
    campo.current?.focus()
  }

  function cambiarZona(id: number) {
    setZonaId(id)
    setResultado(null)
    try {
      localStorage.setItem(CLAVE_ZONA, String(id))
    } catch {
      // Sin almacenamiento: la zona dura hasta recargar
    }
    enfocar()
  }

  /** Valida lo leído (cámara, lector USB o escrito a mano) */
  function procesar(valor: string) {
    if (!zona) {
      setAviso('Elige la zona de ingreso.')
      return
    }
    const id = armarIdentificador(valor)
    if (!id) {
      setAviso('El código corto tiene 8 caracteres (letras y números).')
      return
    }
    setAviso(null)
    setEntradaRegistrada(false)
    entrada.reset()
    setIdentificador(id)
    validar.mutate(
      { ...id, zona_id: zona.id },
      {
        onSuccess: (r) => {
          setResultado(r)
          setTexto('')
        },
        onError: () => setResultado(null),
        onSettled: enfocar,
      },
    )
  }

  function enviarCodigo(e: FormEvent) {
    e.preventDefault()
    procesar(texto)
  }

  function registrarEntrada() {
    if (!identificador || !zona) return
    entrada.mutate(
      { ...identificador, zona_id: zona.id },
      {
        onSuccess: (r) => {
          setResultado(r)
          setEntradaRegistrada(r.registrado)
        },
        onSettled: enfocar,
      },
    )
  }

  // Después de registrar una entrada, se limpia el panel para la siguiente persona
  useEffect(() => {
    if (!entradaRegistrada) return
    const temporizador = window.setTimeout(() => {
      setResultado(null)
      setIdentificador(null)
      setEntradaRegistrada(false)
      entrada.reset()
      campo.current?.focus()
    }, LIMPIAR_TRAS_ENTRADA_MS)
    return () => window.clearTimeout(temporizador)
  }, [entradaRegistrada, entrada])

  if (zonas.isPending) return <Cargando />
  if (zonas.isError) return <ErrorCarga error={zonas.error} alReintentar={() => void zonas.refetch()} />

  return (
    <>
      <EncabezadoPagina titulo="Validar acceso" descripcion="Escanea el QR de la credencial o escribe su código corto." />

      <Row className="g-3">
        {/* Lectura */}
        <Col lg={5}>
          <Card className="shadow-sm h-100">
            <Card.Body className="d-grid gap-3">
              <Form.Group controlId="zona-garita">
                <Form.Label>Zona de ingreso</Form.Label>
                <Form.Select value={zona?.id ?? ''} onChange={(e) => cambiarZona(Number(e.target.value))}>
                  {zonas.data.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.codigo} · {z.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form onSubmit={enviarCodigo}>
                <Form.Label htmlFor="codigo-garita">Código o lector</Form.Label>
                <InputGroup>
                  <Form.Control
                    id="codigo-garita"
                    ref={campo}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Código de 8 caracteres"
                    className="numeros-tabulares"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    disabled={validar.isPending}
                  />
                  <Button type="submit" disabled={validar.isPending} className="d-inline-flex align-items-center gap-2">
                    {validar.isPending ? <Spinner animation="border" size="sm" /> : <Search size={18} />}
                    Validar
                  </Button>
                </InputGroup>
                <Form.Text>También funciona con un lector de códigos USB: lee y pulsa Enter solo.</Form.Text>
              </Form>

              {aviso && (
                <Alert variant="warning" className="py-2 mb-0">
                  {aviso}
                </Alert>
              )}

              <LectorQr alLeer={procesar} />
            </Card.Body>
          </Card>
        </Col>

        {/* Resultado */}
        <Col lg={7}>
          {validar.isError ? (
            <Alert variant="danger" className="fs-5">
              <strong>No autorizado.</strong> {mensaje(validar.error)}
            </Alert>
          ) : resultado ? (
            <PanelResultado
              resultado={resultado}
              entradaRegistrada={entradaRegistrada}
              puedeRegistrar={puedeRegistrar}
              registrando={entrada.isPending}
              errorEntrada={entrada.isError ? mensaje(entrada.error) : null}
              alRegistrar={registrarEntrada}
            />
          ) : (
            <Card className="shadow-sm h-100">
              <Card.Body className="d-flex flex-column align-items-center justify-content-center text-center text-body-secondary py-5">
                <ScanLine size={48} className="mb-3" aria-hidden="true" />
                <div className="fs-5">Esperando credencial</div>
                <div>Zona: {zona ? `${zona.codigo} · ${zona.nombre}` : '—'}</div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </>
  )
}
