import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { Printer, QrCode, ShieldOff } from 'lucide-react'
import { ErrorApi } from '../../api/cliente'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import Paginacion from '../../componentes/Paginacion'
import SelectorContratistaEmpresa, { type Objetivo } from '../../componentes/SelectorContratistaEmpresa'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { infoEstado } from '../../utilidades/estados'
import { formatearFechaHora } from '../../utilidades/fechas'
import { descargarPase, useRevocarCredencial } from './credenciales.api'
import { useCodigosSolicitud, useContratistasNombres, useListaCredenciales } from './lista.api'
import ModalQr from './ModalQr'
import { textoUsos, type Credencial } from './tipos'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTADOS = ['activa', 'usada', 'revocada', 'vencida']

const textoError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null

interface PropsAcciones {
  credencial: Credencial
  /** true en celular y tablet: botones con texto, más fáciles de tocar */
  conTexto?: boolean
  puedeRevocar: boolean
  puedeImprimir: boolean
  descargando: boolean
  alQr: () => void
  alPase: () => void
  alRevocar: () => void
}

/** Solo una credencial activa se puede ver, imprimir o revocar */
function AccionesCredencial({ credencial, conTexto, puedeRevocar, puedeImprimir, descargando, alQr, alPase, alRevocar }: PropsAcciones) {
  if (credencial.estado_efectivo !== 'activa') return <span>—</span>
  const base = 'd-inline-flex align-items-center gap-1 text-nowrap'

  return (
    <div className={conTexto ? 'd-flex flex-wrap gap-2' : 'd-inline-flex gap-1'}>
      <Button variant="secondary" size="sm" className={base} title="Ver QR" aria-label={`Ver QR de la credencial ${credencial.codigo_corto}`} onClick={alQr}>
        <QrCode size={16} aria-hidden="true" />
        {conTexto && 'Ver QR'}
      </Button>
      {puedeImprimir && (
        <Button
          variant="secondary"
          size="sm"
          className={base}
          title="Imprimir pase"
          aria-label={`Imprimir el pase de la credencial ${credencial.codigo_corto}`}
          disabled={descargando}
          onClick={alPase}
        >
          <Printer size={16} aria-hidden="true" />
          {conTexto && 'Imprimir pase'}
        </Button>
      )}
      {puedeRevocar && (
        <Button variant="outline-danger" size="sm" className={base} title="Revocar" aria-label={`Revocar la credencial ${credencial.codigo_corto}`} onClick={alRevocar}>
          <ShieldOff size={16} aria-hidden="true" />
          {conTexto && 'Revocar'}
        </Button>
      )}
    </div>
  )
}

export default function CredencialesPagina() {
  const queryClient = useQueryClient()
  const { perfil } = useSesion()
  const puedeRevocar = tienePermiso(perfil, 'credenciales.revocar')
  const puedeImprimir = tienePermiso(perfil, 'garita.imprimir_pase')
  const puedeVerSolicitud = tienePermiso(perfil, 'solicitudes.ver')

  // ?solicitud_id=... permite llegar con la lista ya filtrada por una solicitud
  const [params, setParams] = useSearchParams()
  const solicitudParam = params.get('solicitud_id') ?? ''
  const solicitudId = UUID.test(solicitudParam) ? solicitudParam : ''

  const [pagina, setPagina] = useState(1)
  const [estado, setEstado] = useState('')
  const [contratista, setContratista] = useState<Objetivo | null>(null)
  const [verQr, setVerQr] = useState<{ id: string; nombre: string } | null>(null)
  const [revocando, setRevocando] = useState<{ credencial: Credencial; nombre: string } | null>(null)

  const consulta = useListaCredenciales({ pagina, estado, contratista_id: contratista?.id ?? '', solicitud_id: solicitudId })
  const contratistas = useContratistasNombres()
  const solicitudes = useCodigosSolicitud(puedeVerSolicitud)
  const revocar = useRevocarCredencial()
  const pase = useMutation({ mutationFn: (c: Credencial) => descargarPase(c) })

  const personas = useMemo(() => new Map((contratistas.data ?? []).map((c) => [c.id, { nombre: `${c.nombres} ${c.apellidos}`, documento: c.documento_identidad }])), [contratistas.data])
  const codigos = useMemo(() => new Map((solicitudes.data ?? []).map((s) => [s.id, s.codigo])), [solicitudes.data])

  // Si no se pudo cruzar el nombre (sin permiso o fuera de los primeros 100), se muestra un fragmento del id
  const personaDe = (c: Credencial) => personas.get(c.contratista_id) ?? { nombre: `Contratista ${c.contratista_id.slice(0, 8)}`, documento: '' }

  const verSolicitud = (c: Credencial) => {
    const codigo = codigos.get(c.solicitud_id)
    return puedeVerSolicitud ? <Link to={`/solicitudes/${c.solicitud_id}`}>{codigo ?? 'Ver solicitud'}</Link> : <span>{codigo ?? '—'}</span>
  }

  function abrirRevocar(credencial: Credencial, nombre: string) {
    revocar.reset()
    setRevocando({ credencial, nombre })
  }

  function quitarFiltros() {
    setEstado('')
    setContratista(null)
    setParams({})
    setPagina(1)
  }

  const credenciales = consulta.data?.datos ?? []
  const hayFiltros = estado !== '' || contratista !== null || solicitudId !== ''
  // El filtro por contratista solo se ofrece si se pueden consultar los contratistas
  const puedeFiltrarPersona = contratistas.isSuccess

  return (
    <>
      <EncabezadoPagina titulo="Credenciales" descripcion="Credenciales emitidas para el ingreso a la planta. Se emiten desde el detalle de cada solicitud aprobada." />

      <Row className="g-2 mb-3 align-items-start">
        <Col xs={12} md={6} lg={4}>
          <Form.Group controlId="cred-estado">
            <Form.Label>Estado</Form.Label>
            <Form.Select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {infoEstado('credencial', e).texto}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        {puedeFiltrarPersona && (
          <Col xs={12} md={6} lg={5}>
            <Form.Label>Contratista</Form.Label>
            <SelectorContratistaEmpresa
              tipo="contratista"
              valor={contratista}
              soloAlEscribir
              alCambiar={(c) => {
                setContratista(c)
                setPagina(1)
              }}
            />
          </Col>
        )}
      </Row>

      {solicitudId && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <Badge bg="info-subtle" text="info-emphasis">
            Solicitud {codigos.get(solicitudId) ?? solicitudId.slice(0, 8)}
          </Badge>
          <Button size="sm" variant="secondary" onClick={() => { setParams({}); setPagina(1) }}>
            Quitar este filtro
          </Button>
        </div>
      )}

      {pase.isError && (
        <Alert variant="danger" dismissible onClose={() => pase.reset()}>
          {textoError(pase.error)}
        </Alert>
      )}

      <Card>
        {consulta.isPending ? (
          <Cargando texto="Cargando credenciales…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : credenciales.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'No hay credenciales con esos filtros' : 'Aún no hay credenciales'}
            descripcion={hayFiltros ? 'Prueba con otros filtros.' : 'Se emiten desde el detalle de una solicitud aprobada.'}
            accion={
              hayFiltros ? (
                <Button size="sm" variant="secondary" onClick={quitarFiltros}>
                  Quitar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table responsive hover className="align-middle mb-0">
            {/* Debajo de 992 px todo va apilado dentro de la primera celda (sin scroll lateral);
                desde 992 px se muestra la tabla completa */}
            <thead>
              <tr>
                <th>Credencial</th>
                <th className="d-none d-lg-table-cell">Contratista</th>
                <th className="d-none d-lg-table-cell">Solicitud</th>
                <th className="d-none d-lg-table-cell">Vigencia</th>
                <th className="d-none d-lg-table-cell">Estado</th>
                <th className="d-none d-lg-table-cell text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {credenciales.map((c) => {
                const persona = personaDe(c)
                const acciones = {
                  credencial: c,
                  puedeRevocar,
                  puedeImprimir,
                  descargando: pase.isPending,
                  alQr: () => setVerQr({ id: c.id, nombre: persona.nombre }),
                  alPase: () => pase.mutate(c),
                  alRevocar: () => abrirRevocar(c, persona.nombre),
                }
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="fw-semibold numeros-tabulares">{c.codigo_corto}</div>
                      <small className="numeros-tabulares">Emitida {formatearFechaHora(c.emitida_en)}</small>

                      {/* Celular y tablet: todo apilado bajo el código (dos columnas en tablet) */}
                      <div className="d-lg-none mt-2">
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                            <div>{persona.nombre}</div>
                            {persona.documento && <small className="numeros-tabulares d-block">{persona.documento}</small>}
                            <div className="small mt-1">Solicitud: {verSolicitud(c)}</div>
                            <div className="small numeros-tabulares">Vence: {formatearFechaHora(c.expira_en)}</div>
                            <div className="small">Usos: {textoUsos(c)}</div>
                          </Col>
                          <Col xs={12} md={6}>
                            <div className="mb-2">
                              <EstadoBadge entidad="credencial" estado={c.estado_efectivo} />
                            </div>
                            {c.estado_efectivo === 'revocada' && c.motivo_revocacion && <div className="small mb-2 text-break">{c.motivo_revocacion}</div>}
                            <AccionesCredencial {...acciones} conTexto />
                          </Col>
                        </Row>
                      </div>
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <div>{persona.nombre}</div>
                      {persona.documento && <small className="numeros-tabulares">{persona.documento}</small>}
                    </td>
                    <td className="d-none d-lg-table-cell">{verSolicitud(c)}</td>
                    <td className="d-none d-lg-table-cell">
                      <div className="numeros-tabulares text-nowrap">{formatearFechaHora(c.expira_en)}</div>
                      <small>Usos: {textoUsos(c)}</small>
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <EstadoBadge entidad="credencial" estado={c.estado_efectivo} />
                      {c.estado_efectivo === 'revocada' && c.motivo_revocacion && (
                        <div className="small mt-1 text-break" style={{ maxWidth: 220 }}>
                          {c.motivo_revocacion}
                        </div>
                      )}
                    </td>
                    <td className="d-none d-lg-table-cell text-end">
                      <AccionesCredencial {...acciones} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {consulta.data && <Paginacion meta={consulta.data.meta} alCambiar={setPagina} deshabilitado={consulta.isPlaceholderData} />}

      <ModalQr credencialId={verQr?.id ?? null} nombreContratista={verQr?.nombre ?? ''} alCerrar={() => setVerQr(null)} />

      <ConfirmarAccion
        mostrar={revocando !== null}
        titulo="Revocar credencial"
        mensaje={
          revocando ? (
            <>
              La credencial <strong>{revocando.credencial.codigo_corto}</strong> de <strong>{revocando.nombre}</strong> dejará de funcionar en garita de inmediato.
            </>
          ) : null
        }
        textoConfirmar="Revocar"
        variante="danger"
        pedirMotivo
        etiquetaMotivo="Motivo de la revocación"
        procesando={revocar.isPending}
        error={textoError(revocar.error)}
        alConfirmar={(motivo) =>
          revocando &&
          revocar.mutate(
            { id: revocando.credencial.id, motivo },
            {
              onSuccess: () => setRevocando(null),
              // 409: otro usuario ya la cambió; se recarga la lista para ver el estado real
              onError: (error) => {
                if (error instanceof ErrorApi && error.status === 409) void queryClient.invalidateQueries({ queryKey: ['credenciales'] })
              },
            },
          )
        }
        alCancelar={() => setRevocando(null)}
      />
    </>
  )
}