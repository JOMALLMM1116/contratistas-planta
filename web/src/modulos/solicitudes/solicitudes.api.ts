import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import type { RequisitosContratista, SolicitudDetalle, SolicitudResumen } from './tipos'

export interface FiltrosSolicitudes {
  pagina: number
  estado?: string
  buscar?: string
}

/** Lista paginada. Mientras carga otra página, se sigue viendo la anterior (sin parpadeo) */
export function useSolicitudes(filtros: FiltrosSolicitudes) {
  return useQuery({
    queryKey: ['solicitudes', filtros],
    queryFn: () =>
      api.get<RespuestaPaginada<SolicitudResumen>>('/solicitudes', {
        pagina: filtros.pagina,
        por_pagina: 20,
        estado: filtros.estado,
        buscar: filtros.buscar,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useSolicitud(id: string) {
  return useQuery({
    queryKey: ['solicitud', id],
    queryFn: () => api.get<RespuestaDatos<SolicitudDetalle>>(`/solicitudes/${id}`).then((r) => r.datos),
  })
}

export function useRequisitos(id: string) {
  return useQuery({
    queryKey: ['solicitud', id, 'requisitos'],
    queryFn: () => api.get<RespuestaDatos<RequisitosContratista[]>>(`/solicitudes/${id}/requisitos`).then((r) => r.datos),
  })
}
