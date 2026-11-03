import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import type { Identificador, Movimiento, PersonaDentro, RespuestaEntrada, RespuestaValidacion, ZonaGarita } from './tipos'

const CODIGO_CORTO = /^[A-Za-z0-9]{8}$/

/**
 * Decide si lo leído es un código corto (8 letras/números, escrito a mano)
 * o el token del QR (texto largo). Devuelve null si no es ninguno de los dos.
 */
export function armarIdentificador(texto: string): Identificador | null {
  const limpio = texto.trim()
  if (CODIGO_CORTO.test(limpio)) return { codigo: limpio.toUpperCase() }
  if (limpio.length >= 20) return { token: limpio }
  return null
}

/**
 * Falla cerrado: si la respuesta no tiene el formato esperado, NO se autoriza.
 * "permitido" debe coincidir con "resultado = valido".
 */
function verificar<T extends RespuestaValidacion>(datos: T): T {
  const formaCorrecta =
    !!datos &&
    typeof datos.resultado === 'string' &&
    typeof datos.permitido === 'boolean' &&
    typeof datos.motivo === 'string' &&
    datos.permitido === (datos.resultado === 'valido')
  if (!formaCorrecta) {
    throw new ErrorApi(0, 'RESPUESTA_INVALIDA', 'Respuesta no válida del servidor: el acceso NO se autoriza.')
  }
  return datos
}

export function useZonasGarita() {
  return useQuery({
    queryKey: ['opciones', 'zonas'],
    queryFn: () =>
      api
        .get<RespuestaPaginada<ZonaGarita>>('/zonas', { por_pagina: 100 })
        .then((r) => r.datos.filter((z) => z.activa)),
    staleTime: 5 * 60_000,
  })
}

/** Solo consulta: no registra la entrada ni consume usos */
export function useValidar() {
  return useMutation({
    mutationFn: (datos: Identificador & { zona_id: number }) =>
      api.post<RespuestaDatos<RespuestaValidacion>>('/garita/validar', datos).then((r) => verificar(r.datos)),
  })
}

/** Registra la entrada (vuelve a validar en el servidor y consume un uso) */
export function useEntrada() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: Identificador & { zona_id: number }) =>
      api.post<RespuestaDatos<RespuestaEntrada>>('/garita/entrada', datos).then((r) => verificar(r.datos)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['garita'] })
      void queryClient.invalidateQueries({ queryKey: ['credenciales'] })
    },
  })
}

/** Personas dentro de la planta; se actualiza sola cada 30 segundos */
export function useDentro(zonaId: number | null) {
  return useQuery({
    queryKey: ['garita', 'dentro', zonaId],
    queryFn: () =>
      api
        .get<{ datos: PersonaDentro[]; meta: { total: number } }>('/garita/dentro', { zona_id: zonaId ?? undefined })
        .then((r) => r.datos),
    refetchInterval: 30_000,
  })
}

/** Registra la salida (no exige credencial válida: nadie debe quedar sin poder salir) */
export function useSalida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: { contratista_id: string; observaciones?: string }) => api.post('/garita/salida', datos),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['garita'] }),
  })
}

export interface FiltrosMovimientos {
  pagina: number
  desde?: string
  hasta?: string
}

export function useMovimientos(filtros: FiltrosMovimientos) {
  return useQuery({
    queryKey: ['garita', 'movimientos', filtros],
    queryFn: () =>
      api.get<RespuestaPaginada<Movimiento>>('/garita/movimientos', {
        pagina: filtros.pagina,
        por_pagina: 20,
        desde: filtros.desde,
        hasta: filtros.hasta,
      }),
    placeholderData: keepPreviousData,
  })
}
