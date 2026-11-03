import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { Ban, CircleCheck, Plus } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaPaginada } from '../../api/tipos'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import Paginacion from '../../componentes/Paginacion'
import { formatearFechaHora } from '../../utilidades/fechas'
import BloqueoFormulario from './BloqueoFormulario'
import { TEXTO_TIPO, type Bloqueo, type DatosBloqueo, type Objetivo } from './tipos'

const POR_PAGINA = 20
const RUTA = '/bloqueos'

const textoError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null

/** Bloqueado (rojo) o Levantado (gris): texto + color + icono */
function EstadoBloqueo({ activo }: { activo: boolean }) {
  return activo ? (
    <Badge bg="danger-subtle" text="danger-emphasis" className="d-inline-flex align-items-center gap-1 fw-semibold">
      <Ban size={13} aria-hidden="true" /> Bloqueado
    </Badge>
  ) : (
    <Badge bg="body-tertiary" text="body-secondary" className="d-inline-flex align-items-center gap-1 fw-semibold border">
      <CircleCheck size={13} aria-hidden="true" /> Levantado
    </Badge>
  )
}

/** A quién afecta el bloqueo: un contratista o una empresa (el backend garantiza solo uno) */
function objetivoDe(b: Bloqueo) {
  if (b.contratista) {
    return { tipo: 'Contratista', nombre: `${b.contratista.nombres} ${b.contratista.apellidos}`, detalle: b.contratista.documento_identidad }
  }
  if (b.empresa) {
    return { tipo: 'Empresa', nombre: b.empresa.razon_social, detalle: `NIT ${b.empresa.nit}` }
  }
  return { tipo: '—', nombre: '—', detalle: '' }
}

function Motivo({ bloqueo }: { bloqueo: Bloqueo }) {
  return (
    <>
      <div className="text-break">{bloqueo.motivo}</div>
      <small className="text-body-secondary">
        {TEXTO_TIPO[bloqueo.tipo]}
        {bloqueo.incidente ? ` · ${bloqueo.incidente.codigo}` : ''}
      </small>
    </>
  )
}

/** Estado más quién lo creó y, si ya se levantó, quién y por qué */
function Trazabilidad({ bloqueo }: { bloqueo: Bloqueo }) {
  return (
    <>
      <EstadoBloqueo activo={bloqueo.activo} />
      <div className="small text-body-secondary mt-1">
        Por {bloqueo.creado_por_usuario.nombre_completo}
        <br />
        <span className="numeros-tabulares">{formatearFechaHora(bloqueo.creado_en)}</span>
      </div>
      {!bloqueo.activo && (
        <div className="small text-body-secondary mt-1 text-break">
          Levantado por {bloqueo.levantado_por_usuario?.nombre_completo ?? '—'} ·{' '}
          <span className="numeros-tabulares">{formatearFechaHora(bloqueo.levantado_en)}</span>
          {bloqueo.motivo_levantamiento ? (
            <>
              <br />
              {bloqueo.motivo_levantamiento}
            </>
          ) : null}
        </div>
      )}
    </>
  )
}

function AccionLevantar({ bloqueo, alLevantar }: { bloqueo: Bloqueo; alLevantar: () => void }) {
  if (!bloqueo.activo) return null
  return (
    <Button
      variant="success"
      size="sm"
      className="d-inline-flex align-items-center gap-1"
      aria-label={`Levantar el bloqueo de ${objetivoDe(bloqueo).nombre}`}
      onClick={alLevantar}
    >
      <CircleCheck size={16} aria-hidden="true" /> Levantar
    </Button>
  )
}

export default function BloqueosPagina() {
  const queryClient = useQueryClient()

  const [pagina, setPagina] = useState(1)
  // Por defecto, los bloqueos activos: son los que importan en la operación
  const [estado, setEstado] = useState('activo')
  const [tipo, setTipo] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [levantando, setLevantando] = useState<Bloqueo | null>(null)

  const consulta = useQuery({
    queryKey: ['bloqueos', { pagina, estado, tipo }],
    queryFn: () =>
      api.get<RespuestaPaginada<Bloqueo>>(RUTA, {
        pagina,
        por_pagina: POR_PAGINA,
        activo: estado === 'activo' ? true : estado === 'levantado' ? false : undefined,
        tipo,
        ordenar_por: 'creado_en',
        orden: 'desc',
      }),
    placeholderData: keepPreviousData,
  })

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['bloqueos'] })

  const crear = useMutation({
    mutationFn: (datos: DatosBloqueo) => api.post(RUTA, datos),
    onSuccess: () => {
      setMostrarFormulario(false)
      void refrescar()
    },
  })

  const levantar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => api.post(`${RUTA}/${id}/levantar`, { motivo }),
    onSuccess: () => {
      setLevantando(null)
      void refrescar()
    },
    // 409: alguien más ya lo levantó; se recarga la lista para ver el estado real
    onError: (error) => {
      if (error instanceof ErrorApi && error.status === 409) void refrescar()
    },
  })

  function abrirFormulario() {
    crear.reset()
    setMostrarFormulario(true)
  }

  function abrirLevantar(bloqueo: Bloqueo) {
    levantar.reset()
    setLevantando(bloqueo)
  }

  function guardar(objetivo: Objetivo, motivo: string) {
    crear.mutate({
      tipo: 'manual',
      motivo,
      ...(objetivo.tipo === 'contratista' ? { contratista_id: objetivo.id } : { empresa_id: objetivo.id }),
    })
  }

  const bloqueos = consulta.data?.datos ?? []
  const soloActivosSinFiltro = estado === 'activo' && tipo === ''

  return (
    <>
      <EncabezadoPagina
        titulo="Bloqueos"
        descripcion="Contratistas y empresas a los que se les impide el ingreso a la planta."
        acciones={
          <Button variant="danger" className="d-inline-flex align-items-center gap-1" onClick={abrirFormulario}>
            <Plus size={16} aria-hidden="true" /> Nuevo bloqueo
          </Button>
        }
      />

      <Row className="g-2 mb-3 align-items-end">
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-estado">
            <Form.Label>Estado</Form.Label>
            <Form.Select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value)
                setPagina(1)
              }}
            >
              <option value="activo">Activos</option>
              <option value="levantado">Levantados (historial)</option>
              <option value="">Todos</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-tipo">
            <Form.Label>Tipo</Form.Label>
            <Form.Select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos los tipos</option>
              <option value="manual">Manual</option>
              <option value="incidente">Incidente</option>
              <option value="documento_vencido">Documento vencido</option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      <Card>
        {consulta.isPending ? (
          <Cargando texto="Cargando bloqueos…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : bloqueos.length === 0 ? (
          <SinDatos
            titulo={soloActivosSinFiltro ? 'No hay bloqueos activos' : 'No hay bloqueos con esos filtros'}
            descripcion={soloActivosSinFiltro ? 'Nadie está bloqueado en este momento.' : 'Prueba con otros filtros.'}
          />
        ) : (
          <Table responsive hover className="align-middle mb-0">
            {/* Debajo de 992 px todo va apilado dentro de la primera celda (sin scroll lateral);
                desde 992 px se muestra la tabla completa */}
            <thead>
              <tr>
                <th>Bloqueado</th>
                <th className="d-none d-lg-table-cell">Motivo</th>
                <th className="d-none d-lg-table-cell">Estado</th>
                <th className="d-none d-lg-table-cell text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bloqueos.map((b) => {
                const objetivo = objetivoDe(b)
                return (
                  <tr key={b.id}>
                    <td>
                      <div className="fw-semibold">{objetivo.nombre}</div>
                      <small className="text-body-secondary">
                        {objetivo.tipo}
                        {objetivo.detalle ? ` · ${objetivo.detalle}` : ''}
                      </small>

                      {/* Celular y tablet: todo apilado bajo el nombre */}
                      <div className="d-lg-none mt-2 d-flex flex-column gap-2">
                        <div>
                          <Motivo bloqueo={b} />
                        </div>
                        <div>
                          <Trazabilidad bloqueo={b} />
                        </div>
                        {b.activo && (
                          <div>
                            <AccionLevantar bloqueo={b} alLevantar={() => abrirLevantar(b)} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <Motivo bloqueo={b} />
                    </td>
                    <td className="d-none d-lg-table-cell">
                      <Trazabilidad bloqueo={b} />
                    </td>
                    <td className="d-none d-lg-table-cell text-end">
                      <AccionLevantar bloqueo={b} alLevantar={() => abrirLevantar(b)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {consulta.data && <Paginacion meta={consulta.data.meta} alCambiar={setPagina} deshabilitado={consulta.isPlaceholderData} />}

      <BloqueoFormulario
        mostrar={mostrarFormulario}
        procesando={crear.isPending}
        error={crear.error}
        alGuardar={guardar}
        alCancelar={() => setMostrarFormulario(false)}
      />

      <ConfirmarAccion
        mostrar={levantando !== null}
        titulo="Levantar bloqueo"
        mensaje={
          levantando ? (
            <>
              Se levantará el bloqueo de <strong>{objetivoDe(levantando).nombre}</strong>. Podrá volver a ingresar si cumple los demás
              requisitos. Queda registrado quién lo levantó y por qué.
            </>
          ) : null
        }
        textoConfirmar="Levantar bloqueo"
        variante="success"
        pedirMotivo
        etiquetaMotivo="Motivo del levantamiento"
        procesando={levantar.isPending}
        error={textoError(levantar.error)}
        alConfirmar={(motivo) => levantando && levantar.mutate({ id: levantando.id, motivo })}
        alCancelar={() => setLevantando(null)}
      />
    </>
  )
}