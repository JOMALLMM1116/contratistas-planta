import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, Col, Form, InputGroup, Row, Table } from 'react-bootstrap'
import { Ban, CircleCheck, KeyRound, Pencil, Plus, Search } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga, SinDatos } from '../../componentes/EstadosPantalla'
import EstadoBadge from '../../componentes/EstadoBadge'
import Paginacion from '../../componentes/Paginacion'
import { useSesion } from '../../sesion/contexto'
import { formatearFechaHora } from '../../utilidades/fechas'
import PasswordTemporal from './PasswordTemporal'
import type { CambiosUsuario, DatosNuevoUsuario, EmpresaOpcion, RespuestaPassword, Rol, Usuario } from './tipos'
import UsuarioFormulario from './UsuarioFormulario'

const POR_PAGINA = 20
const RUTA = '/usuarios'

const textoError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : error ? 'No se pudo completar la acción. Intenta de nuevo.' : null

/** Estado de la cuenta y, si corresponde, el aviso de contraseña pendiente de cambiar */
function EstadoUsuario({ usuario }: { usuario: Usuario }) {
  return (
    <div className="d-flex flex-wrap gap-1">
      <EstadoBadge entidad="usuario" estado={usuario.activo ? 'activo' : 'inactivo'} />
      {usuario.debe_cambiar_password && (
        <Badge bg="warning-subtle" text="warning-emphasis" className="fw-semibold">
          Debe cambiar contraseña
        </Badge>
      )}
    </div>
  )
}

interface PropsAcciones {
  usuario: Usuario
  /** true si es el usuario de la sesión: el backend no permite desactivarse ni restablecerse la contraseña */
  propio: boolean
  /** true en celular y tablet: botones con texto, más fáciles de tocar */
  conTexto?: boolean
  alEditar: () => void
  alRestablecer: () => void
  alCambiarEstado: () => void
}

function AccionesUsuario({ usuario, propio, conTexto, alEditar, alRestablecer, alCambiarEstado }: PropsAcciones) {
  const base = conTexto ? 'd-inline-flex align-items-center gap-1' : ''

  return (
    <div className={conTexto ? 'd-flex flex-wrap gap-2' : 'd-inline-flex gap-1'}>
      <Button variant="outline-secondary" size="sm" className={base} title="Editar" aria-label={`Editar a ${usuario.nombre_completo}`} onClick={alEditar}>
        <Pencil size={16} aria-hidden="true" />
        {conTexto && 'Editar'}
      </Button>
      {!propio && (
        <>
          <Button
            variant="outline-secondary"
            size="sm"
            className={base}
            title="Restablecer contraseña"
            aria-label={`Restablecer la contraseña de ${usuario.nombre_completo}`}
            onClick={alRestablecer}
          >
            <KeyRound size={16} aria-hidden="true" />
            {conTexto && 'Contraseña'}
          </Button>
          <Button
            variant={usuario.activo ? 'outline-danger' : 'success'}
            size="sm"
            className={base}
            title={usuario.activo ? 'Desactivar' : 'Reactivar'}
            aria-label={`${usuario.activo ? 'Desactivar' : 'Reactivar'} a ${usuario.nombre_completo}`}
            onClick={alCambiarEstado}
          >
            {usuario.activo ? <Ban size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
            {conTexto && (usuario.activo ? 'Desactivar' : 'Reactivar')}
          </Button>
        </>
      )}
    </div>
  )
}

export default function UsuariosPagina() {
  const queryClient = useQueryClient()
  const { perfil } = useSesion()
  const miId = perfil?.id

  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [buscar, setBuscar] = useState('')
  const [rolId, setRolId] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [estado, setEstado] = useState('')

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [cambioEstado, setCambioEstado] = useState<Usuario | null>(null)
  const [restableciendo, setRestableciendo] = useState<Usuario | null>(null)
  const [temporal, setTemporal] = useState<{ nombre: string; password: string } | null>(null)

  // Espera a que se deje de escribir antes de consultar
  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscar(busqueda.trim())
      setPagina(1)
    }, 400)
    return () => clearTimeout(espera)
  }, [busqueda])

  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<RespuestaDatos<Rol[]>>('/roles'),
    staleTime: 5 * 60_000,
  })

  const empresas = useQuery({
    queryKey: ['empresas-usuarios'],
    queryFn: () => api.get<RespuestaPaginada<EmpresaOpcion>>('/empresas-contratistas', { por_pagina: 100, ordenar_por: 'razon_social' }),
    staleTime: 5 * 60_000,
  })

  const listaRoles = roles.data?.datos ?? []
  const listaEmpresas = empresas.data?.datos ?? []

  const consulta = useQuery({
    queryKey: ['usuarios', { pagina, buscar, rolId, empresaId, estado }],
    queryFn: () =>
      api.get<RespuestaPaginada<Usuario>>(RUTA, {
        pagina,
        por_pagina: POR_PAGINA,
        buscar,
        rol_id: rolId,
        empresa_id: empresaId,
        activo: estado === 'activo' ? true : estado === 'inactivo' ? false : undefined,
        ordenar_por: 'nombre_completo',
      }),
    placeholderData: keepPreviousData,
  })

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['usuarios'] })

  const guardar = useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: DatosNuevoUsuario | CambiosUsuario }) =>
      id ? api.patch(`${RUTA}/${id}`, datos) : api.post(RUTA, datos),
    onSuccess: () => {
      setMostrarFormulario(false)
      void refrescar()
    },
  })

  // Desactivar y reactivar son un PATCH con activo; desactivar cierra las sesiones del usuario
  const cambiar = useMutation({
    mutationFn: (u: Usuario) => api.patch(`${RUTA}/${u.id}`, { activo: !u.activo }),
    onSuccess: () => {
      setCambioEstado(null)
      void refrescar()
    },
  })

  // La contraseña temporal llega una sola vez: se muestra en un modal
  const restablecer = useMutation({
    mutationFn: (u: Usuario) => api.post<RespuestaDatos<RespuestaPassword>>(`${RUTA}/${u.id}/restablecer-password`),
    onSuccess: (respuesta, u) => {
      setRestableciendo(null)
      setTemporal({ nombre: u.nombre_completo, password: respuesta.datos.password_temporal })
      void refrescar()
    },
  })

  function abrirFormulario(usuario: Usuario | null) {
    guardar.reset()
    setEditando(usuario)
    setMostrarFormulario(true)
  }

  function abrirCambioEstado(usuario: Usuario) {
    cambiar.reset()
    setCambioEstado(usuario)
  }

  function abrirRestablecer(usuario: Usuario) {
    restablecer.reset()
    setRestableciendo(usuario)
  }

  const usuarios = consulta.data?.datos ?? []
  const hayFiltros = buscar !== '' || rolId !== '' || empresaId !== '' || estado !== ''
  const desactivando = cambioEstado?.activo === true

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Cuentas de acceso al sistema, sus roles y su estado."
        acciones={
          <Button className="d-inline-flex align-items-center gap-1" onClick={() => abrirFormulario(null)}>
            <Plus size={16} aria-hidden="true" /> Nuevo usuario
          </Button>
        }
      />

      <Row className="g-2 mb-3 align-items-end">
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-buscar">
            <Form.Label>Buscar</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <Search size={16} aria-hidden="true" />
              </InputGroup.Text>
              <Form.Control type="search" placeholder="Nombre o correo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </InputGroup>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-rol">
            <Form.Label>Rol</Form.Label>
            <Form.Select
              value={rolId}
              onChange={(e) => {
                setRolId(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todos los roles</option>
              {listaRoles.map((rol) => (
                <option key={rol.id} value={rol.id}>
                  {rol.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Form.Group controlId="filtro-empresa">
            <Form.Label>Empresa</Form.Label>
            <Form.Select
              value={empresaId}
              onChange={(e) => {
                setEmpresaId(e.target.value)
                setPagina(1)
              }}
            >
              <option value="">Todas las empresas</option>
              {listaEmpresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.razon_social}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
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
          <Cargando texto="Cargando usuarios…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : usuarios.length === 0 ? (
          <SinDatos
            titulo={hayFiltros ? 'No hay usuarios con esos filtros' : 'Aún no hay usuarios'}
            descripcion={hayFiltros ? 'Prueba con otra búsqueda o quita los filtros.' : 'Crea la primera cuenta.'}
          />
        ) : (
          <Table responsive hover className="align-middle mb-0">
            {/* Debajo de 992 px todo va apilado dentro de la primera celda (sin scroll lateral);
                desde 992 px se muestra la tabla completa */}
            <thead>
              <tr>
                <th>Usuario</th>
                <th className="d-none d-lg-table-cell">Rol</th>
                <th className="d-none d-lg-table-cell">Empresa</th>
                <th className="d-none d-lg-table-cell">Último acceso</th>
                <th className="d-none d-lg-table-cell">Estado</th>
                <th className="d-none d-lg-table-cell text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const propio = u.id === miId
                const alEditar = () => abrirFormulario(u)
                const alRestablecer = () => abrirRestablecer(u)
                const alCambiarEstado = () => abrirCambioEstado(u)
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="fw-semibold">
                        {u.nombre_completo}
                        {propio && (
                          <Badge bg="secondary-subtle" text="secondary-emphasis" className="ms-2">
                            Tú
                          </Badge>
                        )}
                      </div>
                      <small className="text-body-secondary text-break">{u.email}</small>

                      {/* Celular y tablet: todo apilado bajo el nombre (dos columnas en tablet) */}
                      <div className="d-lg-none mt-2">
                        <Row className="g-2">
                          <Col xs={12} md={6}>
                            <div>{u.roles.nombre}</div>
                            <small className="text-body-secondary d-block">{u.empresas_contratistas?.razon_social ?? 'Personal interno'}</small>
                            <small className="text-body-secondary numeros-tabulares">
                              Último acceso: {u.ultimo_acceso ? formatearFechaHora(u.ultimo_acceso) : 'Nunca'}
                            </small>
                          </Col>
                          <Col xs={12} md={6}>
                            <div className="mb-2">
                              <EstadoUsuario usuario={u} />
                            </div>
                            <AccionesUsuario usuario={u} propio={propio} conTexto alEditar={alEditar} alRestablecer={alRestablecer} alCambiarEstado={alCambiarEstado} />
                          </Col>
                        </Row>
                      </div>
                    </td>
                    <td className="d-none d-lg-table-cell">{u.roles.nombre}</td>
                    <td className="d-none d-lg-table-cell">
                      {u.empresas_contratistas ? (
                        <>
                          <div>{u.empresas_contratistas.razon_social}</div>
                          <small className="text-body-secondary">NIT {u.empresas_contratistas.nit}</small>
                        </>
                      ) : (
                        <span className="text-body-secondary">Personal interno</span>
                      )}
                    </td>
                    <td className="d-none d-lg-table-cell numeros-tabulares">{u.ultimo_acceso ? formatearFechaHora(u.ultimo_acceso) : 'Nunca'}</td>
                    <td className="d-none d-lg-table-cell">
                      <EstadoUsuario usuario={u} />
                    </td>
                    <td className="d-none d-lg-table-cell text-end">
                      <AccionesUsuario usuario={u} propio={propio} alEditar={alEditar} alRestablecer={alRestablecer} alCambiarEstado={alCambiarEstado} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {consulta.data && <Paginacion meta={consulta.data.meta} alCambiar={setPagina} deshabilitado={consulta.isPlaceholderData} />}

      <UsuarioFormulario
        mostrar={mostrarFormulario}
        usuario={editando}
        roles={listaRoles}
        empresas={listaEmpresas}
        esPropio={editando !== null && editando.id === miId}
        procesando={guardar.isPending}
        error={guardar.error}
        alCrear={(datos) => guardar.mutate({ datos })}
        alEditar={(cambios) => editando && guardar.mutate({ id: editando.id, datos: cambios })}
        alCancelar={() => setMostrarFormulario(false)}
      />

      <ConfirmarAccion
        mostrar={cambioEstado !== null}
        titulo={desactivando ? 'Desactivar usuario' : 'Reactivar usuario'}
        mensaje={
          desactivando ? (
            <>
              Se desactivará a <strong>{cambioEstado?.nombre_completo}</strong>. No podrá iniciar sesión y se cerrarán de inmediato sus sesiones
              abiertas. Podrás reactivarlo cuando quieras.
            </>
          ) : (
            <>
              Se reactivará a <strong>{cambioEstado?.nombre_completo}</strong> y podrá iniciar sesión de nuevo.
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

      <ConfirmarAccion
        mostrar={restableciendo !== null}
        titulo="Restablecer contraseña"
        mensaje={
          <>
            Se generará una contraseña temporal para <strong>{restableciendo?.nombre_completo}</strong>. Se cerrarán sus sesiones abiertas y
            deberá cambiarla en su próximo ingreso. La contraseña se muestra <strong>una sola vez</strong>.
          </>
        }
        textoConfirmar="Restablecer"
        variante="warning"
        procesando={restablecer.isPending}
        error={textoError(restablecer.error)}
        alConfirmar={() => restableciendo && restablecer.mutate(restableciendo)}
        alCancelar={() => setRestableciendo(null)}
      />

      <PasswordTemporal datos={temporal} alCerrar={() => setTemporal(null)} />
    </>
  )
}