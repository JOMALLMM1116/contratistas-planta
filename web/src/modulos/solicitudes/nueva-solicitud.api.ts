import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import type { SolicitudDetalle } from './tipos'

// Forma de los datos según las respuestas reales de cada catálogo

export interface EmpresaOpcion {
  id: string
  nit: string
  razon_social: string
  estado: string
}

export interface TipoTrabajoOpcion {
  id: number
  codigo: string
  nombre: string
  requiere_permiso_trabajo: boolean
  requiere_evaluacion_riesgo: boolean
  activo: boolean
}

export interface ZonaOpcion {
  id: number
  codigo: string
  nombre: string
  nivel_riesgo: number
  activa: boolean
}

export interface ContratistaOpcion {
  id: string
  nombres: string
  apellidos: string
  documento_identidad: string
  cargo: string | null
}

export interface EquipoOpcion {
  id: string
  codigo: string
  nombre: string
}

/** Cuerpo de POST /solicitudes (solicitada_por lo pone el backend desde la sesión) */
export interface NuevaSolicitud {
  empresa_id: string
  tipo_trabajo_id: number
  responsable_interno_id: string
  descripcion_actividad: string
  fecha_inicio: string
  fecha_fin: string
  hora_inicio: string
  hora_fin: string
  contratistas: string[]
  zonas: number[]
  equipos: string[]
}

// Máximo que permite la paginación del backend
const POR_PAGINA = 100
// Los catálogos cambian poco: se guardan 5 minutos en memoria
const CINCO_MINUTOS = 5 * 60_000

export function useEmpresasActivas() {
  return useQuery({
    queryKey: ['opciones', 'empresas'],
    queryFn: () =>
      api
        .get<RespuestaPaginada<EmpresaOpcion>>('/empresas-contratistas', { por_pagina: POR_PAGINA })
        .then((r) => r.datos.filter((e) => e.estado === 'activa')),
    staleTime: CINCO_MINUTOS,
  })
}

export function useTiposTrabajoActivos() {
  return useQuery({
    queryKey: ['opciones', 'tipos-trabajo'],
    queryFn: () =>
      api
        .get<RespuestaPaginada<TipoTrabajoOpcion>>('/tipos-trabajo', { por_pagina: POR_PAGINA })
        .then((r) => r.datos.filter((t) => t.activo)),
    staleTime: CINCO_MINUTOS,
  })
}

export function useZonasActivas() {
  return useQuery({
    queryKey: ['opciones', 'zonas'],
    queryFn: () =>
      api
        .get<RespuestaPaginada<ZonaOpcion>>('/zonas', { por_pagina: POR_PAGINA })
        .then((r) => r.datos.filter((z) => z.activa)),
    staleTime: CINCO_MINUTOS,
  })
}

/** Solo se consulta cuando ya hay una empresa elegida */
export function useContratistasDeEmpresa(empresaId: string) {
  return useQuery({
    queryKey: ['opciones', 'contratistas', empresaId],
    queryFn: () =>
      api
        .get<RespuestaPaginada<ContratistaOpcion>>('/contratistas', {
          empresa_id: empresaId,
          estado: 'activo',
          por_pagina: POR_PAGINA,
        })
        .then((r) => r.datos),
    enabled: empresaId !== '',
  })
}

export function useEquiposDeEmpresa(empresaId: string) {
  return useQuery({
    queryKey: ['opciones', 'equipos', empresaId],
    queryFn: () =>
      api
        .get<RespuestaPaginada<EquipoOpcion>>('/equipos', {
          empresa_id: empresaId,
          estado: 'activo',
          por_pagina: POR_PAGINA,
        })
        .then((r) => r.datos),
    enabled: empresaId !== '',
  })
}

export function useCrearSolicitud() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: NuevaSolicitud) =>
      api.post<RespuestaDatos<SolicitudDetalle>>('/solicitudes', datos).then((r) => r.datos),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['solicitudes'] }),
  })
}
