import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import type { Credencial, CredencialConQr } from './tipos'

export interface DatosEmitir {
  solicitud_id: string
  contratista_id: string
  /** Sin valor = ingresos ilimitados durante la vigencia */
  usos_maximos?: number
}

/** Credenciales de una solicitud (más recientes primero) */
export function useCredencialesDeSolicitud(solicitudId: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['credenciales', { solicitud_id: solicitudId }],
    queryFn: () =>
      api
        .get<RespuestaPaginada<Credencial>>('/credenciales', { solicitud_id: solicitudId, por_pagina: 100 })
        .then((r) => r.datos),
    enabled: habilitado,
  })
}

/**
 * QR de una credencial activa. Se pide solo mientras el diálogo está abierto
 * y no se conserva en caché al cerrarlo (contiene el token firmado).
 */
export function useQrCredencial(id: string | null) {
  return useQuery({
    queryKey: ['credencial-qr', id],
    queryFn: () => api.get<RespuestaDatos<CredencialConQr>>(`/credenciales/${id}/qr`).then((r) => r.datos),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  })
}

export function useEmitirCredencial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: DatosEmitir) =>
      api.post<RespuestaDatos<CredencialConQr>>('/credenciales', datos).then((r) => r.datos),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['credenciales'] }),
  })
}

export function useRevocarCredencial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => api.post(`/credenciales/${id}/revocar`, { motivo }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['credenciales'] }),
  })
}

/** Descarga el pase en PDF (el backend solo lo genera para credenciales activas y vigentes) */
export function descargarPase(credencial: Pick<Credencial, 'id' | 'codigo_corto'>) {
  return api.descargar(`/garita/pase/${credencial.id}`, `pase-${credencial.codigo_corto}.pdf`)
}
