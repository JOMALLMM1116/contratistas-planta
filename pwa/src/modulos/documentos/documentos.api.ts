import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import type { RespuestaDatos, RespuestaPaginada } from '../../api/tipos'
import type { DatosDocumento, Documento, TipoDocumentoOpcion } from './tipos'

/** Mis documentos: el backend ya devuelve solo los del alcance del usuario */
export function useDocumentos() {
  return useQuery({
    queryKey: ['documentos'],
    queryFn: () => api.get<RespuestaPaginada<Documento>>('/documentos', { por_pagina: 100, ordenar_por: 'created_at', orden: 'desc' }),
  })
}

/** Solo los tipos que aplican a un contratista */
export function useTiposDocumento(habilitado: boolean) {
  return useQuery({
    queryKey: ['tipos-documento-contratista'],
    queryFn: () =>
      api
        .get<RespuestaPaginada<TipoDocumentoOpcion>>('/tipos-documento', { aplica_a: 'contratista', por_pagina: 100, ordenar_por: 'nombre' })
        .then((r) => r.datos),
    enabled: habilitado,
    staleTime: 5 * 60_000,
  })
}

/**
 * Subir un documento son dos pasos: primero el archivo (POST /archivos) y luego el documento
 * (POST /documentos). Si el archivo ya llegó y el segundo paso falla, el reintento no lo vuelve a enviar.
 */
export function useSubirDocumento() {
  const queryClient = useQueryClient()
  const subido = useRef<{ archivo: File; id: string } | null>(null)
  const [paso, setPaso] = useState<'archivo' | 'documento' | null>(null)

  const mutacion = useMutation({
    mutationFn: async ({ archivo, contratistaId, datos }: { archivo: File; contratistaId: string; datos: DatosDocumento }) => {
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

      setPaso('documento')
      return api.post('/documentos', { ...datos, contratista_id: contratistaId, archivo_id: archivoId })
    },
    onSuccess: () => {
      subido.current = null
      void queryClient.invalidateQueries({ queryKey: ['documentos'] })
    },
    onSettled: () => setPaso(null),
  })

  return {
    ...mutacion,
    paso,
    /** true si este archivo ya llegó al servidor y solo falta guardar el documento */
    yaSubido: (archivo: File | null) => archivo !== null && subido.current?.archivo === archivo,
    olvidarArchivo: () => {
      subido.current = null
    },
  }
}