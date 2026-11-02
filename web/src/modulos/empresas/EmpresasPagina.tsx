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
import EmpresaFormulario from './EmpresaFormulario'
import type { DatosEmpresa, Empresa } from './tipos'

const POR_PAGINA = 20
const RUTA = '/empresas-contratistas'

const textoError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null

export default function EmpresasPagina() {
  const queryClient = useQueryClient()

  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('')

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editando, setEditando] = useState<Empresa | null>(null)
  const [cambioEstado, setCambioEstado] = useState<Empresa | null>(null)

  // Espera a que se deje de escribir antes de consultar
  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscar(busqueda.trim())
      setPagina(1)
    }, 400)
    return () => clearTimeout(espera)
  }, [busqueda])

  const consulta = useQuery({
    queryKey: ['empresas', { pagina, buscar, estado }],
    queryFn: () =>
      api.get<RespuestaPaginada<Empresa>>(RUTA, { pagina, por_pagina: POR_PAGINA, buscar, estado, ordenar_por: 'razon_social' }),
    placeholderData: keepPreviousData,
  })

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['empresas'] })

  const guardar = useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: DatosEmpresa }) =>
      id ? api.patch<RespuestaDatos<Empresa>>(`${RUTA}/${id}`, datos) : api.post<RespuestaDatos<Empresa>>(RUTA, datos),
    onSuccess: () => {
      setMostrarFormulario(false)
      void refrescar()
    },
  })

  // Desactivar = DELETE (borrado lógico); reactivar = PATCH con estado activa
  const cambiar = useMutation({
    mutationFn: (empresa: Empresa) =>
      empresa.estado === 'activa' ? api.delete(`${RUTA}/${empresa.id}`) : api.patch(`${RUTA}/${empresa.id}`, { estado: 'activa' }),
    onSuccess: () => {
      setCambioEstado(null)
      void refrescar()
    },
  })

  function abrirFormulario(empresa: Empresa | null) {
    guardar.reset()
    setEditando(empresa)
    setMostrarFormulario(true)
  }

  function abrirCambioEstado(empresa: Empresa) {
    cambiar.reset()
    setCambioEstado(empresa)
  }

  const empresas = consulta.data?.datos ?? []
  const hayFiltros = buscar !== '' || estado !== ''
  const desactivando = cambioEstado?.estado === 'activa'

  return (
    <>
      <EncabezadoPagina
        titulo="Empresas"
        descripcion="Empresas contratistas que pueden solicitar acceso a la planta."
        acciones={
          <Button className="d-inline-flex align-items-center gap-1" onClick={() => abrirFormulario(null)}>
            <Plus size={16} aria-hidden="true" /> Nueva empresa
          </Button>
        }
      />

      <Row className="g-2 mb-3">
        <Col xs={12} md={7} lg={5}>
          <InputGroup>
            <InputGroup.Text>
              <Search size={16} aria-hidden="true" />
            </InputGroup.Text>
            <Form.Control
              type="search"
              placeholder="Buscar por NIT, razón social o contacto"
              aria-label="Buscar empresas"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </InputGroup>
        </Col>
        <Col xs={12} md={5} lg={3}>
          <Form.Select
            aria-label="Filtrar por estado"
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value)
              setPagina(1)
            }}
          >
            <option value="">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
          </Form.Select>
        </Col>
      </Row>

      <Card>
        {consulta.isPending ? (
          <Cargando texto="Cargando empresas…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : empresas.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'No hay empresas con esos filtros' : 'Aún no hay empresas registradas'}
            descripcion={hayFiltros ? 'Prueba con otra búsqueda o quita los filtros.' : 'Registra la primera empresa contratista.'}
            accion={
              hayFiltros ? undefined : (
                <Button size="sm" onClick={() => abrirFormulario(null)}>
                  Nueva empresa
                </Button>
              )
            }
          />
        ) : (
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>NIT</th>
                <th>Razón social</th>
                <th className="d-none d-lg-table-cell">Contacto</th>
                <th className="d-none d-md-table-cell text-end">Contratistas</th>
                <th className="d-none d-md-table-cell text-end">Equipos</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => {
                const activa = empresa.estado === 'activa'
                return (
                  <tr key={empresa.id}>
                    <td className="numeros-tabulares">{empresa.nit}</td>
                    <td className="fw-semibold">{empresa.razon_social}</td>
                    <td className="d-none d-lg-table-cell">
                      <div>{empresa.nombre_contacto ?? '—'}</div>
                      <small className="text-body-secondary">{empresa.email_contacto ?? empresa.telefono ?? ''}</small>
                    </td>
                    <td className="d-none d-md-table-cell text-end numeros-tabulares">{empresa._count.contratistas}</td>
                    <td className="d-none d-md-table-cell text-end numeros-tabulares">{empresa._count.equipos}</td>
                    <td>
                      {/* El backend usa activa/inactiva; el badge compartido usa activo/inactivo */}
                      <EstadoBadge entidad="usuario" estado={activa ? 'activo' : 'inactivo'} />
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          title="Editar"
                          aria-label={`Editar ${empresa.razon_social}`}
                          onClick={() => abrirFormulario(empresa)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Button>
                        <Button
                          variant={activa ? 'outline-danger' : 'outline-success'}
                          size="sm"
                          title={activa ? 'Desactivar' : 'Reactivar'}
                          aria-label={`${activa ? 'Desactivar' : 'Reactivar'} ${empresa.razon_social}`}
                          onClick={() => abrirCambioEstado(empresa)}
                        >
                          {activa ? <Ban size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
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

      <EmpresaFormulario
        mostrar={mostrarFormulario}
        empresa={editando}
        procesando={guardar.isPending}
        error={guardar.error}
        alGuardar={(datos) => guardar.mutate({ id: editando?.id, datos })}
        alCancelar={() => setMostrarFormulario(false)}
      />

      <ConfirmarAccion
        mostrar={cambioEstado !== null}
        titulo={desactivando ? 'Desactivar empresa' : 'Reactivar empresa'}
        mensaje={
          desactivando ? (
            <>
              Se desactivará <strong>{cambioEstado?.razon_social}</strong>. No podrá crear nuevas solicitudes de acceso, pero sus
              contratistas, equipos y solicitudes se conservan. Podrás reactivarla cuando quieras.
            </>
          ) : (
            <>
              Se reactivará <strong>{cambioEstado?.razon_social}</strong> y podrá volver a solicitar accesos.
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