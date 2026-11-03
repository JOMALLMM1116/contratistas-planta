import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import type { RespuestaDatos } from '../../api/tipos'
import type { Dashboard } from './tipos'

/** "dias" (0 a 365) define la ventana de los vencimientos */
export function useDashboard(dias: number) {
  return useQuery({
    queryKey: ['dashboard', dias],
    queryFn: () => api.get<RespuestaDatos<Dashboard>>('/reportes/dashboard', { dias }).then((r) => r.datos),
    placeholderData: keepPreviousData,
  })
}