import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import type { RequisitosContratista, SolicitudDetalle, SolicitudResumen } from './tipos'

export interface FiltrosSolicitudes {
  pagina: number
  estado?: string
  buscar?: string
}

/** Cuerpo de POST /solicitudes/:id/evaluacion-riesgo (el evaluador sale de la sesión) */
export interface DatosEvaluacion {
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico'
  peligros_identificados: string
  medidas_control: string
  epp_requerido?: string
  resultado: 'aprobada' | 'condicionada' | 'rechazada'
}

/** Cuerpo de POST /solicitudes/:id/autorizaciones (el usuario sale de la sesión) */
export interface DatosAutorizacion {
  decision: 'aprobada' | 'rechazada'
  comentario?: string
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

/** Acciones del flujo. Al terminar, se recargan el detalle, sus requisitos y la lista */
export function useAccionesSolicitud(id: string) {
  const queryClient = useQueryClient()
  const recargar = () => {
    void queryClient.invalidateQueries({ queryKey: ['solicitud', id] })
    void queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
  }

  const enviar = useMutation({
    mutationFn: () => api.post(`/solicitudes/${id}/enviar`),
    onSuccess: recargar,
  })

  const cancelar = useMutation({
    mutationFn: (motivo: string) => api.post(`/solicitudes/${id}/cancelar`, { motivo }),
    onSuccess: recargar,
  })

  const evaluar = useMutation({
    mutationFn: (datos: DatosEvaluacion) => api.post(`/solicitudes/${id}/evaluacion-riesgo`, datos),
    onSuccess: recargar,
  })

  const autorizar = useMutation({
    mutationFn: (datos: DatosAutorizacion) => api.post(`/solicitudes/${id}/autorizaciones`, datos),
    onSuccess: recargar,
  })

  return { enviar, cancelar, evaluar, autorizar }
}
