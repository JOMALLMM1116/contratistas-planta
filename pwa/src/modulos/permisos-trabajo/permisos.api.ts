import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaDatos } from '../../api/tipos'
import type { Checklist, Evidencia, MomentoEvidencia, PermisoDetalle, RespuestaItem } from './tipos'

const RUTA = '/permisos-trabajo'

export function usePermiso(id: string) {
  return useQuery({
    queryKey: ['permiso', id],
    queryFn: () => api.get<RespuestaDatos<PermisoDetalle>>(`${RUTA}/${id}`).then((r) => r.datos),
  })
}

export function useChecklist(id: string) {
  return useQuery({
    queryKey: ['permiso-checklist', id],
    queryFn: () => api.get<RespuestaDatos<Checklist>>(`${RUTA}/${id}/checklist`).then((r) => r.datos),
  })
}

export function useEvidencias(id: string) {
  return useQuery({
    queryKey: ['permiso-evidencias', id],
    queryFn: () => api.get<RespuestaDatos<Evidencia[]>>(`${RUTA}/${id}/evidencias`).then((r) => r.datos),
  })
}

/** Tras cualquier cambio se recarga todo lo del permiso */
function useRecargar(id: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['permiso', id] })
    void queryClient.invalidateQueries({ queryKey: ['permiso-checklist', id] })
    void queryClient.invalidateQueries({ queryKey: ['permiso-evidencias', id] })
    void queryClient.invalidateQueries({ queryKey: ['permiso-de-solicitud'] })
  }
}

/** Iniciar y cerrar la actividad: quién lo hace sale de la sesión */
export function useAccionesPermiso(id: string) {
  const recargar = useRecargar(id)
  // 409: otro cambió el permiso o no cumple las condiciones; se recarga para ver el estado real
  const alFallar = (error: unknown) => {
    if (error instanceof ErrorApi && error.status === 409) recargar()
  }

  const iniciar = useMutation({
    mutationFn: () => api.post(`${RUTA}/${id}/iniciar`),
    onSuccess: recargar,
    onError: alFallar,
  })

  const cerrar = useMutation({
    mutationFn: (observaciones: string | undefined) => api.post(`${RUTA}/${id}/cerrar`, observaciones ? { observaciones } : {}),
    onSuccess: recargar,
    onError: alFallar,
  })

  return { iniciar, cerrar }
}

export function useGuardarChecklist(id: string) {
  const recargar = useRecargar(id)
  return useMutation({
    mutationFn: (respuestas: RespuestaItem[]) => api.post(`${RUTA}/${id}/checklist`, { respuestas }),
    onSuccess: recargar,
  })
}

/**
 * Agregar una evidencia son dos pasos: primero el archivo (POST /archivos) y luego la evidencia.
 * Si el archivo ya llegó y el segundo paso falla, el reintento no lo vuelve a enviar.
 */
export function useAgregarEvidencia(id: string) {
  const recargar = useRecargar(id)
  const subido = useRef<{ archivo: File; id: string } | null>(null)
  const [paso, setPaso] = useState<'archivo' | 'evidencia' | null>(null)

  const mutacion = useMutation({
    mutationFn: async ({ archivo, momento, descripcion }: { archivo: File; momento: MomentoEvidencia; descripcion: string }) => {
      let archivoId = subido.current?.archivo === archivo ? subido.current.id : null

      if (!archivoId) {
        setPaso('archivo')
        const formulario = new FormData()
        formulario.append('archivo', archivo)
        const respuesta = await api.post<RespuestaDatos<{ id?: string }>>('/archivos', formulario)
        archivoId = respuesta.datos?.id ?? null
        if (!archivoId) throw new Error('El servidor no devolvió el identificador del archivo.')
        subido.current = { archivo, id: archivoId }
      }

      setPaso('evidencia')
      return api.post(`${RUTA}/${id}/evidencias`, { archivo_id: archivoId, momento, ...(descripcion ? { descripcion } : {}) })
    },
    onSuccess: () => {
      subido.current = null
      recargar()
    },
    onSettled: () => setPaso(null),
  })

  return {
    ...mutacion,
    paso,
    /** true si este archivo ya llegó al servidor y solo falta guardar la evidencia */
    yaSubido: (archivo: File | null) => archivo !== null && subido.current?.archivo === archivo,
    olvidarArchivo: () => {
      subido.current = null
    },
  }
}