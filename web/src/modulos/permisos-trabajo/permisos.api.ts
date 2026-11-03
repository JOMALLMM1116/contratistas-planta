import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import type { Permiso, PermisoDetalle, SolicitudAprobada } from './tipos'

const RUTA = '/permisos-trabajo'

export interface FiltrosPermisos {
  pagina: number
  estado?: string
  buscar?: string
  empresa_id?: string
  desde?: string
  hasta?: string
}

/** Cuerpo de POST /permisos-trabajo (quien aprueba sale de la sesión) */
export interface DatosEmision {
  solicitud_id: string
  condiciones_especiales?: string
}

/** Lista paginada. Mientras carga otra página, se sigue viendo la anterior (sin parpadeo) */
export function usePermisos(filtros: FiltrosPermisos, habilitado = true) {
  return useQuery({
    queryKey: ['permisos', filtros],
    queryFn: () =>
      api.get<RespuestaPaginada<Permiso>>(RUTA, {
        pagina: filtros.pagina,
        por_pagina: 20,
        estado: filtros.estado,
        buscar: filtros.buscar,
        empresa_id: filtros.empresa_id,
        desde: filtros.desde,
        hasta: filtros.hasta,
        ordenar_por: 'emitido_en',
        orden: 'desc',
      }),
    enabled: habilitado,
    placeholderData: keepPreviousData,
  })
}

export function usePermiso(id: string | null) {
  return useQuery({
    queryKey: ['permiso', id],
    queryFn: () => api.get<RespuestaDatos<PermisoDetalle>>(`${RUTA}/${id}`).then((r) => r.datos),
    enabled: id !== null,
  })
}

// ---- Solicitudes que esperan permiso (selector de "Emitir permiso") ----
// El backend no tiene un filtro "sin permiso", así que se arma con tres consultas:
//   1. tipos de trabajo con requiere_permiso_trabajo = true
//   2. solicitudes aprobadas de cada uno de esos tipos (tipo_trabajo_id admite un solo valor)
//   3. solicitud_id de los permisos ya emitidos (en cualquier estado: uno revocado también ocupa la solicitud)
// Es solo una ayuda: el servidor vuelve a validar todo al emitir.

const CLAVE_PENDIENTES = 'solicitudes-pendientes-permiso'
const POR_PAGINA_MAX = 100
/** Tope de páginas de permisos que se recorren (100 × 10 = 1000 permisos) */
const TOPE_PAGINAS_PERMISOS = 10

interface TipoTrabajoCatalogo {
  id: number
  requiere_permiso_trabajo: boolean
}

interface ResultadoPendientes {
  solicitudes: SolicitudAprobada[]
  /** Alguna lista de solicitudes se cortó en 100 */
  cortada: boolean
  /** Se llegó al tope de páginas de permisos: podría colarse alguna que ya tiene permiso */
  permisosIncompletos: boolean
}

type ClienteConsultas = ReturnType<typeof useQueryClient>

function tiposConPermiso(queryClient: ClienteConsultas) {
  return queryClient.fetchQuery({
    queryKey: [CLAVE_PENDIENTES, 'tipos'],
    queryFn: () =>
      api
        .get<RespuestaPaginada<TipoTrabajoCatalogo>>('/tipos-trabajo', { requiere_permiso_trabajo: true, por_pagina: POR_PAGINA_MAX })
        // Se repite el filtro por si el servidor lo ignorara
        .then((r) => r.datos.filter((t) => t.requiere_permiso_trabajo).map((t) => t.id)),
    staleTime: 5 * 60_000,
  })
}

function solicitudesConPermiso(queryClient: ClienteConsultas) {
  return queryClient.fetchQuery({
    queryKey: [CLAVE_PENDIENTES, 'emitidas'],
    queryFn: async () => {
      const pedirPagina = (pagina: number) =>
        api.get<RespuestaPaginada<Pick<Permiso, 'solicitud_id'>>>(RUTA, { pagina, por_pagina: POR_PAGINA_MAX, ordenar_por: 'emitido_en', orden: 'desc' })
      const primera = await pedirPagina(1)
      const ultima = Math.min(primera.meta.total_paginas, TOPE_PAGINAS_PERMISOS)
      const resto = await Promise.all(Array.from({ length: Math.max(ultima - 1, 0) }, (_, i) => pedirPagina(i + 2)))
      const ids = new Set([primera, ...resto].flatMap((r) => r.datos.map((p) => p.solicitud_id)))
      return { ids, incompletos: primera.meta.total_paginas > TOPE_PAGINAS_PERMISOS }
    },
    staleTime: 15_000,
  })
}

async function cargarPendientes(queryClient: ClienteConsultas, buscar?: string): Promise<ResultadoPendientes> {
  const [tipos, emitidas] = await Promise.all([tiposConPermiso(queryClient), solicitudesConPermiso(queryClient)])
  const listas = await Promise.all(
    tipos.map((tipo_trabajo_id) =>
      api.get<RespuestaPaginada<SolicitudAprobada>>('/solicitudes', {
        estado: 'aprobada',
        tipo_trabajo_id,
        buscar,
        por_pagina: POR_PAGINA_MAX,
        ordenar_por: 'fecha_inicio',
        orden: 'asc',
      }),
    ),
  )
  const solicitudes = listas
    .flatMap((r) => r.datos)
    .filter((s) => !emitidas.ids.has(s.id))
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio) || a.codigo.localeCompare(b.codigo))
  return {
    solicitudes,
    cortada: listas.some((r) => r.meta.total > r.datos.length),
    permisosIncompletos: emitidas.incompletos,
  }
}

/** Minúsculas y sin tildes, para comparar */
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Solicitudes aprobadas, de un tipo que requiere permiso y sin permiso emitido.
 * `buscar` filtra en la Web por código de solicitud o razón social. Si la lista base se cortó en 100,
 * además se consulta al servidor con `buscar` (que busca por código) para no perder coincidencias.
 */
export function useSolicitudesPendientesDePermiso(buscar: string, habilitado: boolean) {
  const queryClient = useQueryClient()

  const base = useQuery({
    queryKey: [CLAVE_PENDIENTES, 'lista'],
    queryFn: () => cargarPendientes(queryClient),
    enabled: habilitado,
    staleTime: 15_000,
  })

  const buscarEnServidor = habilitado && buscar !== '' && base.data?.cortada === true
  const busqueda = useQuery({
    queryKey: [CLAVE_PENDIENTES, 'lista', buscar],
    queryFn: () => cargarPendientes(queryClient, buscar),
    enabled: buscarEnServidor,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  })

  const termino = normalizar(buscar)
  const coincide = (s: SolicitudAprobada) =>
    normalizar(s.codigo).includes(termino) || normalizar(s.empresas_contratistas.razon_social).includes(termino)

  let solicitudes = base.data?.solicitudes ?? []
  let cortada = base.data?.cortada ?? false
  if (termino !== '') {
    solicitudes = solicitudes.filter(coincide)
    if (buscarEnServidor && busqueda.data) {
      // Lo que encontró el servidor ya coincide por código (o descripción): se suma sin repetir
      const vistas = new Set(solicitudes.map((s) => s.id))
      solicitudes = [...solicitudes, ...busqueda.data.solicitudes.filter((s) => !vistas.has(s.id))]
      cortada = busqueda.data.cortada
    }
  }

  return {
    solicitudes,
    cortada,
    permisosIncompletos: base.data?.permisosIncompletos ?? false,
    cargando: base.isPending || (buscarEnServidor && busqueda.isPending),
    buscandoMas: buscarEnServidor && busqueda.isFetching,
    error: base.error ?? busqueda.error,
    listo: base.isSuccess,
  }
}

export function useEmitirPermiso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: DatosEmision) => api.post<RespuestaDatos<PermisoDetalle>>(RUTA, datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['permisos'] })
      // La solicitud ya tiene permiso: debe salir del selector
      void queryClient.invalidateQueries({ queryKey: [CLAVE_PENDIENTES] })
    },
  })
}

export function useRevocarPermiso() {
  const queryClient = useQueryClient()
  const recargar = () => {
    void queryClient.invalidateQueries({ queryKey: ['permisos'] })
    void queryClient.invalidateQueries({ queryKey: ['permiso'] })
  }
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => api.post(`${RUTA}/${id}/revocar`, { motivo }),
    onSuccess: recargar,
    // 409: otro usuario ya cambió el permiso; se recarga para ver el estado real
    onError: (error) => {
      if (error instanceof ErrorApi && error.status === 409) recargar()
    },
  })
}