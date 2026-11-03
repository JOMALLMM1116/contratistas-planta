import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Form, InputGroup, Row, Table } from 'react-bootstrap'
import { Plus, Search, ShieldOff } from 'lucide-react'
import { ErrorApi } from '../../api/cliente'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import Paginacion from '../../componentes/Paginacion'
import SelectorEmpresa from '../../componentes/SelectorEmpresa'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { formatearDia, formatearFechaHora } from '../../utilidades/fechas'
import { hora, puedeRevocarse } from './ayudas'
import PermisoDetalle from './PermisoDetalle'
import PermisoEmitir from './PermisoEmitir'
import { useEmitirPermiso, usePermisos, useRevocarPermiso } from './permisos.api'
import type { Permiso } from './tipos'

const textoError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null

function Vigencia({ permiso }: { permiso: Permiso }) {
  return (
    <>
      <div className="numeros-tabulares">
        {formatearDia(permiso.fecha_inicio)} – {formatearDia(permiso.fecha_fin)}
      </div>
      <div className="text-body numeros-tabulares">
        {hora(permiso.hora_inicio)} – {hora(permiso.hora_fin)}
      </div>
    </>
  )
}

interface PropsAcciones {
  permiso: Permiso
  /** true en celular y tablet: botones con texto, más fáciles de tocar */
  conTexto?: boolean
  puedeRevocar: boolean
  alVer: () => void
  alRevocar: () => void
}

function AccionesPermiso({ permiso, conTexto, puedeRevocar, alVer, alRevocar }: PropsAcciones) {
  const base = conTexto ? 'd-inline-flex align-items-center gap-1' : ''
  return (
    <div className={conTexto ? 'd-flex flex-wrap gap-2' : 'd-inline-flex gap-1'}>
      <Button variant="secondary" size="sm" className="text-nowrap" aria-label={`Ver detalle de ${permiso.codigo}`} onClick={alVer}>
        Ver detalle
      </Button>
      {puedeRevocar && puedeRevocarse(permiso.estado) && (
        <Button
          variant="outline-danger"
          size="sm"
          className={`${base} text-nowrap`}
          title="Revocar"
          aria-label={`Revocar ${permiso.codigo}`}
          onClick={alRevocar}
        >
          <ShieldOff size={16} aria-hidden="true" />
          {conTexto && 'Revocar'}
        </Button>
      )}
    </div>
  )
}

export default function PermisosTrabajoPagina() {
  const { perfil } = useSesion()
  // Cada acción exige su propio permiso en el backend
  const puedeEmitir = tienePermiso(perfil, 'permisos_trabajo.emitir')
  const puedeRevocar = tienePermiso(perfil, 'permisos_trabajo.revocar')

  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const [mostrarEmitir, setMostrarEmitir] = useState(false)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [revocando, setRevocando] = useState<{ id: string; codigo: string } | null>(null)
  const [emitido, setEmitido] = useState<string | null>(null)

  // Espera a que se deje de escribir antes de consultar
  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscar(busqueda.trim())
      setPagina(1)
    }, 400)
    return () => clearTimeout(espera)
  }, [busqueda])

  const rangoInvalido = desde !== '' && hasta !== '' && hasta < desde
  const consulta = usePermisos({ pagina, estado, buscar, empresa_id: empresaId, desde, hasta }, !rangoInvalido)
  const emitir = useEmitirPermiso()
  const revocar = useRevocarPermiso()

  function abrirEmitir() {
    emitir.reset()
    setMostrarEmitir(true)
  }

  function abrirRevocar(permiso: { id: string; codigo: string }) {
    revocar.reset()
    setRevocando(permiso)
  }

  function limpiarFiltros() {
    setBusqueda('')
    setBuscar('')
    setEstado('')
    setEmpresaId('')
    setDesde('')
    setHasta('')
    setPagina(1)
  }

  const permisos = consulta.data?.datos ?? []
  const hayFiltros = buscar !== '' || estado !== '' || empresaId !== '' || desde !== '' || hasta !== ''

  return (
    <>
      <EncabezadoPagina
        titulo="Permisos de trabajo"
        descripcion="Permisos emitidos a partir de solicitudes aprobadas, y su estado."
        acciones={
          puedeEmitir ? (
            <Button className="d-inline-flex align-items-center gap-1" onClick={abrirEmitir}>
              <Plus size={16} aria-hidden="true" /> Emitir permiso
            </Button>
          ) : undefined
        }
      />

      {emitido && (
        <Alert variant="success" dismissible onClose={() => setEmitido(null)}>
          Permiso <strong>{emitido}</strong> emitido correctamente.
        </Alert>
      )}

      {/* align-items-start: etiquetas y controles quedan a la misma altura aunque un campo muestre su error debajo */}
      <Row className="g-2 mb-3 align-items-start">
        <Col xs={12} md={6} lg={4} xl={3}>
          <SelectorEmpresa
            id="filtro-empresa"
            etiqueta="Empresa"
            valor={empresaId}
            soloActivas={false}
            opcionVacia="Todas las empresas"
            alCambiar={(id) => {
              setEmpresaId(id)
              setPagina(1)
            }}
          />
        </Col>
        <Col xs={12} md={6} lg={4} xl={3}>
          <Form.Group controlId="filtro-buscar">
            <Form.Label>Buscar</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <Search size={16} aria-hidden="true" />
              </InputGroup.Text>
              <Form.Control type="search" placeholder="Código del permiso" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </InputGroup>
          </Form.Group>
        </Col>
        <Col xs={12} md={4} lg={4} xl={2}>
          <Form.Group controlId="filtro-estado">
            <Form.Label>Estado</Form.Label>
            <Form.Select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos los estados</option>
              <option value="emitido">Emitidos</option>
              <option value="en_ejecucion">En ejecución</option>
              <option value="cerrado">Cerrados</option>
              <option value="revocado">Revocados</option>
              <option value="vencido">Vencidos</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={4} lg={6} xl={2}>
          <Form.Group controlId="filtro-desde">
            <Form.Label>Vigencia desde</Form.Label>
            <Form.Control
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value)
                setPagina(1)
              }}
            />
          </Form.Group>
        </Col>
        <Col xs={12} md={4} lg={6} xl={2}>
          <Form.Group controlId="filtro-hasta">
            <Form.Label>Vigencia hasta</Form.Label>
            <Form.Control
              type="date"
              value={hasta}
              isInvalid={rangoInvalido}
              onChange={(e) => {
                setHasta(e.target.value)
                setPagina(1)
              }}
            />
            <Form.Control.Feedback type="invalid">La fecha final no puede ser anterior a la inicial.</Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>

      <Card>
        {rangoInvalido ? (
          <SinDatos titulo="Revisa el rango de fechas" descripcion="La fecha final no puede ser anterior a la inicial." />
        ) : consulta.isPending ? (
          <Cargando texto="Cargando permisos…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : permisos.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'No hay permisos con esos filtros' : 'Aún no hay permisos de trabajo'}
            descripcion={hayFiltros ? 'Prueba con otros filtros.' : 'Se emiten a partir de una solicitud aprobada.'}
            accion={
              hayFiltros ? (
                <Button size="sm" variant="secondary" onClick={limpiarFiltros}>
                  Quitar filtros
                </Button>
              ) : puedeEmitir ? (
                <Button size="sm" onClick={abrirEmitir}>
                  Emitir permiso
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
                <th>Permiso</th>
                <th className="d-none d-lg-table-cell">Solicitud y empresa</th>
                <th className="d-none d-lg-table-cell">Vigencia</th>
                <th className="d-none d-lg-table-cell">Estado</th>
                <th className="d-none d-lg-table-cell text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {permisos.map((p) => {
                const alVer = () => setDetalleId(p.id)
                const alRevocar = () => abrirRevocar({ id: p.id, codigo: p.codigo })
                const sol = p.solicitudes_acceso
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="fw-semibold numeros-tabulares">{p.codigo}</div>
                      <small className="text-body-secondary numeros-tabulares">Emitido {formatearFechaHora(p.emitido_en)}</small>

                      {/* Celular y tablet: todo apilado bajo el código (dos columnas en tablet) */}
                      <div className="d-lg-none mt-2">
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                            <div>{sol.empresas_contratistas.razon_social}</div>
                            <div className="text-body">
                              {sol.tipos_trabajo.nombre} · {sol.codigo}
                            </div>
                            <Vigencia permiso={p} />
                          </Col>
                          <Col xs={12} md={6}>
                            <div className="mb-2">
                              <EstadoBadge entidad="permiso_trabajo" estado={p.estado} />
                            </div>
                            <AccionesPermiso permiso={p} conTexto puedeRevocar={puedeRevocar} alVer={alVer} alRevocar={alRevocar} />
                          </Col>
                        </Row>
                      </div>
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <div>{sol.empresas_contratistas.razon_social}</div>
                      <div className="text-body">
                        {sol.tipos_trabajo.nombre} · {sol.codigo}
                      </div>
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <Vigencia permiso={p} />
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <EstadoBadge entidad="permiso_trabajo" estado={p.estado} />
                    </td>
                    <td className="d-none d-lg-table-cell text-end">
                      <AccionesPermiso permiso={p} puedeRevocar={puedeRevocar} alVer={alVer} alRevocar={alRevocar} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {consulta.data && !rangoInvalido && <Paginacion meta={consulta.data.meta} alCambiar={setPagina} deshabilitado={consulta.isPlaceholderData} />}

      <PermisoEmitir
        mostrar={mostrarEmitir}
        procesando={emitir.isPending}
        error={emitir.error}
        alEmitir={(datos) =>
          emitir.mutate(datos, {
            onSuccess: (respuesta) => {
              setMostrarEmitir(false)
              setEmitido(respuesta.datos.codigo)
            },
          })
        }
        alCancelar={() => setMostrarEmitir(false)}
      />

      {/* Con la confirmación abierta, el detalle se oculta para no apilar dos modales */}
      <PermisoDetalle
        id={detalleId}
        visible={revocando === null}
        puedeRevocar={puedeRevocar}
        alCerrar={() => setDetalleId(null)}
        alRevocar={abrirRevocar}
      />

      <ConfirmarAccion
        mostrar={revocando !== null}
        titulo="Revocar permiso"
        mensaje={
          <>
            El permiso <strong>{revocando?.codigo}</strong> pasará a «Revocado» y quedará registrado quién lo revocó y por qué. Como cada
            solicitud tiene un solo permiso, no se podrá emitir otro para ella.
          </>
        }
        textoConfirmar="Revocar permiso"
        variante="danger"
        pedirMotivo
        etiquetaMotivo="Motivo de la revocación"
        procesando={revocar.isPending}
        error={textoError(revocar.error)}
        alConfirmar={(motivo) => revocando && revocar.mutate({ id: revocando.id, motivo }, { onSuccess: () => setRevocando(null) })}
        alCancelar={() => setRevocando(null)}
      />
    </>
  )
}