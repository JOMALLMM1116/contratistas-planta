import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Col, Form, InputGroup, Row, Table } from 'react-bootstrap'
import { Ban, CircleCheck, Pencil, Plus, Search } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import Paginacion from '../../componentes/Paginacion'
import ContratistaFormulario from './ContratistaFormulario'
import SelectorEmpresa from '../../componentes/SelectorEmpresa'
import type { Contratista, DatosContratista } from './tipos'

const POR_PAGINA = 20
const RUTA = '/contratistas'

const textoError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null

export default function ContratistasPagina() {
  const queryClient = useQueryClient()

  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [buscar, setBuscar] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [estado, setEstado] = useState('')

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editando, setEditando] = useState<Contratista | null>(null)
  const [cambioEstado, setCambioEstado] = useState<Contratista | null>(null)

  // Espera a que se deje de escribir antes de consultar
  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscar(busqueda.trim())
      setPagina(1)
    }, 400)
    return () => clearTimeout(espera)
  }, [busqueda])

  const consulta = useQuery({
    queryKey: ['contratistas', { pagina, buscar, empresaId, estado }],
    queryFn: () =>
      api.get<RespuestaPaginada<Contratista>>(RUTA, {
        pagina,
        por_pagina: POR_PAGINA,
        buscar,
        empresa_id: empresaId,
        estado,
      }),
    placeholderData: keepPreviousData,
  })

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['contratistas'] })

  const guardar = useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: DatosContratista }) =>
      id ? api.patch<RespuestaDatos<Contratista>>(`${RUTA}/${id}`, datos) : api.post<RespuestaDatos<Contratista>>(RUTA, datos),
    onSuccess: () => {
      setMostrarFormulario(false)
      void refrescar()
    },
  })

  // Desactivar = DELETE (borrado lógico); reactivar = PATCH con estado activo
  const cambiar = useMutation({
    mutationFn: (c: Contratista) =>
      c.estado === 'activo' ? api.delete(`${RUTA}/${c.id}`) : api.patch(`${RUTA}/${c.id}`, { estado: 'activo' }),
    onSuccess: () => {
      setCambioEstado(null)
      void refrescar()
    },
  })

  function abrirFormulario(c: Contratista | null) {
    guardar.reset()
    setEditando(c)
    setMostrarFormulario(true)
  }

  function abrirCambioEstado(c: Contratista) {
    cambiar.reset()
    setCambioEstado(c)
  }

  const contratistas = consulta.data?.datos ?? []
  const hayFiltros = buscar !== '' || empresaId !== '' || estado !== ''
  const desactivando = cambioEstado?.estado === 'activo'
  const nombreCambio = cambioEstado ? `${cambioEstado.nombres} ${cambioEstado.apellidos}` : ''

  return (
    <>
      <EncabezadoPagina
        titulo="Contratistas"
        descripcion="Personal de las empresas contratistas que solicita acceso a la planta."
        acciones={
          <Button className="d-inline-flex align-items-center gap-1" onClick={() => abrirFormulario(null)}>
            <Plus size={16} aria-hidden="true" /> Nuevo contratista
          </Button>
        }
      />

      {/* Los tres filtros llevan etiqueta, así quedan a la misma altura */}
      <Row className="g-2 mb-3 align-items-end">
        <Col xs={12} md={6} lg={4}>
          <Form.Group controlId="filtro-buscar">
            <Form.Label>Buscar</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <Search size={16} aria-hidden="true" />
              </InputGroup.Text>
              <Form.Control
                type="search"
                placeholder="Nombre, documento o correo"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </InputGroup>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={5}>
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
              <option value="">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      <Card>
        {consulta.isPending ? (
          <Cargando texto="Cargando contratistas…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : contratistas.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'No hay contratistas con esos filtros' : 'Aún no hay contratistas registrados'}
            descripcion={hayFiltros ? 'Prueba con otra búsqueda o quita los filtros.' : 'Registra al primer contratista.'}
            accion={
              hayFiltros ? undefined : (
                <Button size="sm" onClick={() => abrirFormulario(null)}>
                  Nuevo contratista
                </Button>
              )
            }
          />
        ) : (
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Contratista</th>
                <th className="d-none d-md-table-cell">Documento</th>
                <th className="d-none d-md-table-cell">Empresa</th>
                <th className="d-none d-lg-table-cell">Contacto</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contratistas.map((c) => {
                const activo = c.estado === 'activo'
                const nombre = `${c.nombres} ${c.apellidos}`
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="fw-semibold">{nombre}</div>
                      <small className="text-body-secondary">{c.cargo ?? ''}</small>
                      {/* En celular, documento y empresa se muestran bajo el nombre */}
                      <div className="d-md-none">
                        <small className="text-body-secondary numeros-tabulares">{c.documento_identidad}</small>
                        <br />
                        <small className="text-body-secondary">{c.empresas_contratistas.razon_social}</small>
                      </div>
                    </td>
                    <td className="d-none d-md-table-cell numeros-tabulares">{c.documento_identidad}</td>
                    <td className="d-none d-md-table-cell">{c.empresas_contratistas.razon_social}</td>
                    <td className="d-none d-lg-table-cell">
                      <div>{c.email ?? '—'}</div>
                      <small className="text-body-secondary">{c.telefono ?? ''}</small>
                    </td>
                    <td>
                      <EstadoBadge entidad="usuario" estado={c.estado} />
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          title="Editar"
                          aria-label={`Editar ${nombre}`}
                          onClick={() => abrirFormulario(c)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Button>
                        <Button
                          variant={activo ? 'outline-danger' : 'outline-success'}
                          size="sm"
                          title={activo ? 'Desactivar' : 'Reactivar'}
                          aria-label={`${activo ? 'Desactivar' : 'Reactivar'} ${nombre}`}
                          onClick={() => abrirCambioEstado(c)}
                        >
                          {activo ? <Ban size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {consulta.data && <Paginacion meta={consulta.data.meta} alCambiar={setPagina} deshabilitado={consulta.isPlaceholderData} />}

      <ContratistaFormulario
        mostrar={mostrarFormulario}
        contratista={editando}
        procesando={guardar.isPending}
        error={guardar.error}
        alGuardar={(datos) => guardar.mutate({ id: editando?.id, datos })}
        alCancelar={() => setMostrarFormulario(false)}
      />

      <ConfirmarAccion
        mostrar={cambioEstado !== null}
        titulo={desactivando ? 'Desactivar contratista' : 'Reactivar contratista'}
        mensaje={
          desactivando ? (
            <>
              Se desactivará a <strong>{nombreCambio}</strong>. No podrá incluirse en nuevas solicitudes de acceso, pero sus
              documentos, capacitaciones e historial se conservan. Podrás reactivarlo cuando quieras.
            </>
          ) : (
            <>
              Se reactivará a <strong>{nombreCambio}</strong> y podrá volver a incluirse en solicitudes de acceso.
            </>
          )
        }
        textoConfirmar={desactivando ? 'Desactivar' : 'Reactivar'}
        variante={desactivando ? 'danger' : 'success'}
        procesando={cambiar.isPending}
        error={textoError(cambiar.error)}
        alConfirmar={() => cambioEstado && cambiar.mutate(cambioEstado)}
        alCancelar={() => setCambioEstado(null)}
      />
    </>
  )
}