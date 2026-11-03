import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import type { RespuestaPaginada } from '../../api/tipos'
import type { Credencial } from './tipos'

export interface FiltrosLista {
  pagina: number
  /** Estado guardado en la base (el backend filtra por este, no por estado_efectivo) */
  estado: string
  contratista_id: string
  solicitud_id: string
}

/** Lista general de credenciales, más recientes primero */
export function useListaCredenciales(f: FiltrosLista) {
  return useQuery({
    queryKey: ['credenciales', 'lista', f],
    queryFn: () =>
      api.get<RespuestaPaginada<Credencial>>('/credenciales', {
        pagina: f.pagina,
        por_pagina: 20,
        estado: f.estado,
        contratista_id: f.contratista_id,
        solicitud_id: f.solicitud_id,
        ordenar_por: 'emitida_en',
        orden: 'desc',
      }),
    placeholderData: keepPreviousData,
  })
}

export interface ContratistaNombre {
  id: string
  nombres: string
  apellidos: string
  documento_identidad: string
}

/** La lista de credenciales no trae nombres: se cruzan por id con los primeros 100 contratistas */
export function useContratistasNombres() {
  return useQuery({
    queryKey: ['credenciales-contratistas'],
    queryFn: () =>
      api.get<RespuestaPaginada<ContratistaNombre>>('/contratistas', { por_pagina: 100, ordenar_por: 'apellidos' }).then((r) => r.datos),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/** Códigos de solicitud (SA-2026-00001) para mostrar junto al enlace; solo si el usuario puede ver solicitudes */
export function useCodigosSolicitud(habilitado: boolean) {
  return useQuery({
    queryKey: ['credenciales-solicitudes'],
    queryFn: () =>
      api
        .get<RespuestaPaginada<{ id: string; codigo: string }>>('/solicitudes', { por_pagina: 100, ordenar_por: 'created_at', orden: 'desc' })
        .then((r) => r.datos),
    enabled: habilitado,
    staleTime: 5 * 60_000,
    retry: false,
  })
}