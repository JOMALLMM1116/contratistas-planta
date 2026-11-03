import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import type { RequisitosContratista, SolicitudDetalle, SolicitudResumen } from './tipos'

/** Lista paginada. El backend ya filtra por alcance: el contratista ve donde participa; el supervisor, las de su empresa */
export function useSolicitudes(pagina: number, estado: string) {
  return useQuery({
    queryKey: ['solicitudes', { pagina, estado }],
    queryFn: () =>
      api.get<RespuestaPaginada<SolicitudResumen>>('/solicitudes', {
        pagina,
        por_pagina: 10,
        estado,
        ordenar_por: 'created_at',
        orden: 'desc',
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