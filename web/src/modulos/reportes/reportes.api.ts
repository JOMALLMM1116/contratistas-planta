import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import { hoyGuatemala } from '../../utilidades/fechas'
import { CONFIG } from './config'
import type { FiltrosReporte, FormatoReporte, RespuestaReporte } from './tipos'

/** Solo se envían los filtros que aplican al tipo de reporte */
function parametros(f: FiltrosReporte, formato: FormatoReporte) {
  const cfg = CONFIG[f.tipo]
  return {
    formato,
    empresa_id: f.empresa_id,
    estado: cfg.estados.length > 0 ? f.estado : undefined,
    desde: cfg.fechas ? f.desde : undefined,
    hasta: cfg.fechas ? f.hasta : undefined,
    dias: cfg.dias ? Number(f.dias) : undefined,
  }
}

export function useVistaPrevia(filtros: FiltrosReporte, habilitado: boolean) {
  return useQuery({
    queryKey: ['reporte', filtros],
    queryFn: () => api.get<RespuestaReporte>(`/reportes/${filtros.tipo}`, parametros(filtros, 'json')),
    enabled: habilitado,
    placeholderData: keepPreviousData,
  })
}

/** Descarga el archivo en Excel o PDF con los mismos filtros de la vista previa */
export function useDescargaReporte() {
  return useMutation({
    mutationFn: ({ filtros, formato }: { filtros: FiltrosReporte; formato: 'excel' | 'pdf' }) => {
      const extension = formato === 'excel' ? 'xlsx' : 'pdf'
      return api.descargar(`/reportes/${filtros.tipo}`, `reporte-${filtros.tipo}-${hoyGuatemala()}.${extension}`, parametros(filtros, formato))
    },
  })
}