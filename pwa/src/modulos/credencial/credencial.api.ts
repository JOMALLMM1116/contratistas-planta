import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import type { RespuestaDatos } from '../../api/tipos'
import type { Credencial, CredencialConQr } from './tipos'

/** Datos de la solicitud que se muestran junto a la credencial */
export interface SolicitudDeCredencial {
  id: string
  codigo: string
  descripcion_actividad: string
  solicitud_zonas: { zonas: { id: number; codigo: string; nombre: string } }[]
}

/** Credenciales del contratista que inició sesión (el backend filtra por la sesión) */
export function useMisCredenciales() {
  return useQuery({
    queryKey: ['credenciales', 'mias'],
    queryFn: () => api.get<RespuestaDatos<Credencial[]>>('/credenciales/mias').then((r) => r.datos),
  })
}

/** Solicitud de una credencial (con SEG-01, el contratista solo ve las suyas) */
export function useSolicitudDeCredencial(solicitudId: string) {
  return useQuery({
    queryKey: ['solicitudes', solicitudId],
    queryFn: () => api.get<RespuestaDatos<SolicitudDeCredencial>>(`/solicitudes/${solicitudId}`).then((r) => r.datos),
    staleTime: 5 * 60_000,
  })
}

/**
 * QR de una credencial propia. Se pide solo mientras está abierto
 * y no se conserva en caché al cerrarlo (contiene el token firmado).
 */
export function useQrPropio(id: string | null) {
  return useQuery({
    queryKey: ['credencial-qr', id],
    queryFn: () => api.get<RespuestaDatos<CredencialConQr>>(`/credenciales/${id}/qr`).then((r) => r.datos),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  })
}
