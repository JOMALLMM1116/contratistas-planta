import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Col, Form, InputGroup, ListGroup, Modal, Row } from 'react-bootstrap'
import { Download, Search, X } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import { formatearFechaHora } from '../../utilidades/fechas'
import { afectadosDe } from './ayudas'
import SeveridadBadge from './SeveridadBadge'
import type { ArchivoOpcion, ArchivoResumen, Incidente } from './tipos'

const RUTA = '/incidentes'

type Confirmacion = { tipo: 'investigar' } | { tipo: 'cerrar' } | { tipo: 'eliminar' } | { tipo: 'quitar'; archivo: ArchivoResumen }

const textoError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null

interface Props {
  /** null = cerrado */
  id: string | null
  alCerrar: () => void
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="small text-body-secondary">{etiqueta}</div>
      <div className="text-break">{children}</div>
    </div>
  )
}

export default function IncidenteDetalle({ id, alCerrar }: Props) {
  const queryClient = useQueryClient()

  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)
  const [acciones, setAcciones] = useState('')
  const [busquedaArchivo, setBusquedaArchivo] = useState('')
  const [buscarArchivo, setBuscarArchivo] = useState('')

  const consulta = useQuery({
    queryKey: ['incidente', id],
    queryFn: () => api.get<RespuestaDatos<Incidente>>(`${RUTA}/${id}`),
    enabled: id !== null,
  })
  const incidente = consulta.data?.datos
  const puedeEditar = incidente !== undefined && incidente.estado !== 'cerrado'

  // Al abrir otro incidente se limpia lo que había
  useEffect(() => {
    setConfirmacion(null)
    setBusquedaArchivo('')
    setBuscarArchivo('')
  }, [id])

  // El cuadro de acciones correctivas parte de lo guardado
  useEffect(() => {
    setAcciones(incidente?.acciones_correctivas ?? '')
  }, [incidente?.id, incidente?.acciones_correctivas])

  // Espera a que se deje de escribir antes de buscar archivos
  useEffect(() => {
    const espera = setTimeout(() => setBuscarArchivo(busquedaArchivo.trim()), 300)
    return () => clearTimeout(espera)
  }, [busquedaArchivo])

  const archivos = useQuery({
    queryKey: ['archivos-selector', buscarArchivo],
    queryFn: () => api.get<RespuestaPaginada<ArchivoOpcion>>('/archivos', { buscar: buscarArchivo, por_pagina: 8 }),
    enabled: puedeEditar,
  })

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['incidentes'] })
    void queryClient.invalidateQueries({ queryKey: ['incidente', id] })
  }

  // 409: alguien más cambió el incidente; se recarga para ver el estado real
  const alFallar = (error: unknown) => {
    if (error instanceof ErrorApi && error.status === 409) refrescar()
  }

  const guardarAcciones = useMutation({
    mutationFn: () => api.patch(`${RUTA}/${id}`, { acciones_correctivas: acciones.trim() || null }),
    onSuccess: refrescar,
    onError: alFallar,
  })

  const vincular = useMutation({
    mutationFn: (archivoId: string) => api.post(`${RUTA}/${id}/evidencias`, { archivo_id: archivoId }),
    onSuccess: refrescar,
    onError: alFallar,
  })

  const descarga = useMutation({
    mutationFn: (archivo: ArchivoResumen) => api.descargar(`/archivos/${archivo.id}/descargar`, archivo.nombre_original),
  })

  // Las acciones correctivas escritas se envían al cerrar solo si son válidas y cambiaron
  const textoAcciones = acciones.trim()
  const accionesCambiaron = textoAcciones !== (incidente?.acciones_correctivas ?? '')
  const enviarAccionesAlCerrar = textoAcciones.length >= 3 && accionesCambiaron

  const cambiar = useMutation({
    mutationFn: (c: Confirmacion) => {
      switch (c.tipo) {
        case 'investigar':
          return api.post(`${RUTA}/${id}/investigar`)
        case 'cerrar':
          return api.post(`${RUTA}/${id}/cerrar`, enviarAccionesAlCerrar ? { acciones_correctivas: textoAcciones } : {})
        case 'eliminar':
          return api.delete(`${RUTA}/${id}`)
        case 'quitar':
          return api.delete(`${RUTA}/${id}/evidencias/${c.archivo.id}`)
      }
    },
    onSuccess: (_datos, c) => {
      setConfirmacion(null)
      refrescar()
      if (c.tipo === 'eliminar') alCerrar()
    },
    onError: alFallar,
  })

  function abrirConfirmacion(c: Confirmacion) {
    cambiar.reset()
    setConfirmacion(c)
  }

  const disponibles = (archivos.data?.datos ?? []).filter((a) => !incidente?.evidencias.some((e) => e.id === a.id))
  const afectados = incidente ? afectadosDe(incidente) : []

  const configuracion = (() => {
    if (!confirmacion || !incidente) return null
    switch (confirmacion.tipo) {
      case 'investigar':
        return {
          titulo: 'Iniciar investigación',
          mensaje: <>El incidente <strong>{incidente.codigo}</strong> pasará a «En investigación». Queda registrado quién lo hizo y cuándo.</>,
          texto: 'Iniciar investigación',
          variante: 'primary' as const,
        }
      case 'cerrar':
        return {
          titulo: 'Cerrar incidente',
          mensaje: (
            <>
              El incidente <strong>{incidente.codigo}</strong> pasará a «Cerrado» y quedará registrado quién lo cerró. Después no se puede
              reabrir ni cambiar sus evidencias.
              {enviarAccionesAlCerrar && <> Las acciones correctivas escritas se guardarán al cerrar.</>}
            </>
          ),
          texto: 'Cerrar incidente',
          variante: 'success' as const,
        }
      case 'eliminar':
        return {
          titulo: 'Eliminar incidente',
          mensaje: <>Se eliminará <strong>{incidente.codigo}</strong>. Esta acción no se puede deshacer. Solo se eliminan incidentes abiertos.</>,
          texto: 'Eliminar',
          variante: 'danger' as const,
        }
      case 'quitar':
        return {
          titulo: 'Quitar evidencia',
          mensaje: <>Se quitará <strong>{confirmacion.archivo.nombre_original}</strong> de este incidente. El archivo no se elimina del sistema.</>,
          texto: 'Quitar',
          variante: 'danger' as const,
        }
    }
  })()

  return (
    <>
      {/* Con una confirmación abierta, el detalle se oculta para no apilar dos modales */}
      <Modal show={id !== null && confirmacion === null} onHide={alCerrar} size="lg" fullscreen="sm-down" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5 d-flex flex-wrap align-items-center gap-2 mb-0">
            {incidente?.codigo ?? 'Incidente'}
            {incidente && (
              <>
                <EstadoBadge entidad="incidente" estado={incidente.estado} />
                <SeveridadBadge severidad={incidente.severidad} />
              </>
            )}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {consulta.isPending && <Cargando texto="Cargando incidente…" />}
          {consulta.isError && <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />}

          {incidente && (
            <>
              <Row className="g-3 mb-3">
                <Col xs={12} md={6}>
                  <Dato etiqueta="Afecta a">
                    {afectados.map((a) => (
                      <div key={a.tipo}>
                        {a.nombre}
                        <small className="text-body-secondary d-block">
                          {a.tipo}
                          {a.detalle ? ` · ${a.detalle}` : ''}
                        </small>
                      </div>
                    ))}
                  </Dato>
                </Col>
                <Col xs={12} md={6}>
                  <Dato etiqueta="Zona">{incidente.zona ? `${incidente.zona.codigo} · ${incidente.zona.nombre}` : '—'}</Dato>
                </Col>
                <Col xs={12} md={6}>
                  <Dato etiqueta="Ocurrió">
                    <span className="numeros-tabulares">{formatearFechaHora(incidente.fecha_ocurrencia)}</span>
                  </Dato>
                </Col>
                <Col xs={12} md={6}>
                  <Dato etiqueta="Reportado por">
                    {incidente.reportado_por_usuario.nombre_completo}
                    <small className="text-body-secondary d-block numeros-tabulares">{formatearFechaHora(incidente.created_at)}</small>
                  </Dato>
                </Col>
                {incidente.estado === 'cerrado' && (
                  <Col xs={12} md={6}>
                    <Dato etiqueta="Cerrado por">
                      {incidente.cerrado_por_usuario?.nombre_completo ?? '—'}
                      <small className="text-body-secondary d-block numeros-tabulares">{formatearFechaHora(incidente.cerrado_en)}</small>
                    </Dato>
                  </Col>
                )}
                <Col xs={12}>
                  <Dato etiqueta="Descripción">{incidente.descripcion}</Dato>
                </Col>
              </Row>

              <Form.Group controlId="incidente-acciones" className="mb-4">
                <Form.Label>Acciones correctivas</Form.Label>
                {puedeEditar ? (
                  <>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      maxLength={2000}
                      value={acciones}
                      onChange={(e) => setAcciones(e.target.value)}
                      disabled={guardarAcciones.isPending}
                    />
                    <div className="d-flex justify-content-end mt-2">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        disabled={!accionesCambiaron || guardarAcciones.isPending}
                        onClick={() => guardarAcciones.mutate()}
                      >
                        Guardar acciones
                      </Button>
                    </div>
                    {guardarAcciones.isError && (
                      <Alert variant="danger" className="py-2 mt-2 mb-0">
                        {textoError(guardarAcciones.error)}
                      </Alert>
                    )}
                  </>
                ) : (
                  <div className="text-break">{incidente.acciones_correctivas ?? '—'}</div>
                )}
              </Form.Group>

              <h3 className="h6">Evidencias ({incidente.evidencias.length})</h3>
              {descarga.isError && (
                <Alert variant="danger" dismissible onClose={() => descarga.reset()} className="py-2">
                  {textoError(descarga.error)}
                </Alert>
              )}
              {incidente.evidencias.length === 0 ? (
                <p className="text-body-secondary small">Sin evidencias vinculadas.</p>
              ) : (
                <ListGroup className="mb-3">
                  {incidente.evidencias.map((e) => (
                    <ListGroup.Item key={e.id} className="d-flex align-items-center justify-content-between gap-2">
                      <span className="text-break">{e.nombre_original}</span>
                      <span className="d-inline-flex gap-1 flex-shrink-0">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          title="Descargar"
                          aria-label={`Descargar ${e.nombre_original}`}
                          disabled={descarga.isPending}
                          onClick={() => descarga.mutate(e)}
                        >
                          <Download size={16} aria-hidden="true" />
                        </Button>
                        {puedeEditar && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            title="Quitar"
                            aria-label={`Quitar ${e.nombre_original}`}
                            onClick={() => abrirConfirmacion({ tipo: 'quitar', archivo: e })}
                          >
                            <X size={16} aria-hidden="true" />
                          </Button>
                        )}
                      </span>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}

              {puedeEditar && (
                <div>
                  <Form.Label htmlFor="incidente-buscar-archivo" className="small">
                    Vincular un archivo ya subido
                  </Form.Label>
                  <InputGroup size="sm" className="mb-2">
                    <InputGroup.Text>
                      <Search size={14} aria-hidden="true" />
                    </InputGroup.Text>
                    <Form.Control
                      id="incidente-buscar-archivo"
                      type="search"
                      placeholder="Buscar por nombre de archivo"
                      value={busquedaArchivo}
                      onChange={(e) => setBusquedaArchivo(e.target.value)}
                    />
                  </InputGroup>
                  {vincular.isError && (
                    <Alert variant="danger" className="py-2">
                      {textoError(vincular.error)}
                    </Alert>
                  )}
                  <ListGroup>
                    {archivos.isPending && <ListGroup.Item disabled>Buscando…</ListGroup.Item>}
                    {archivos.isError && <ListGroup.Item className="text-danger">No se pudieron cargar los archivos.</ListGroup.Item>}
                    {archivos.isSuccess && disponibles.length === 0 && <ListGroup.Item disabled>Sin archivos para vincular</ListGroup.Item>}
                    {disponibles.map((a) => (
                      <ListGroup.Item key={a.id} className="d-flex align-items-center justify-content-between gap-2">
                        <span className="text-break">
                          {a.nombre_original}
                          <small className="text-body-secondary d-block numeros-tabulares">{formatearFechaHora(a.created_at)}</small>
                        </span>
                        <Button size="sm" variant="outline-secondary" className="flex-shrink-0" disabled={vincular.isPending} onClick={() => vincular.mutate(a.id)}>
                          Vincular
                        </Button>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              )}
            </>
          )}
        </Modal.Body>

        <Modal.Footer className="flex-wrap">
          {incidente?.estado === 'abierto' && (
            <>
              <Button variant="outline-danger" onClick={() => abrirConfirmacion({ tipo: 'eliminar' })}>
                Eliminar
              </Button>
              <Button variant="primary" onClick={() => abrirConfirmacion({ tipo: 'investigar' })}>
                Iniciar investigación
              </Button>
            </>
          )}
          {incidente?.estado === 'en_investigacion' && (
            <Button variant="success" onClick={() => abrirConfirmacion({ tipo: 'cerrar' })}>
              Cerrar incidente
            </Button>
          )}
          <Button variant="outline-secondary" onClick={alCerrar}>
            Volver
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmarAccion
        mostrar={configuracion !== null}
        titulo={configuracion?.titulo ?? ''}
        mensaje={configuracion?.mensaje ?? null}
        textoConfirmar={configuracion?.texto ?? 'Confirmar'}
        variante={configuracion?.variante ?? 'primary'}
        procesando={cambiar.isPending}
        error={textoError(cambiar.error)}
        alConfirmar={() => confirmacion && cambiar.mutate(confirmacion)}
        alCancelar={() => {
          cambiar.reset()
          setConfirmacion(null)
        }}
      />
    </>
  )
}