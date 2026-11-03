import { Pagination } from 'react-bootstrap'
import type { MetaPaginacion } from '../api/tipos'

interface Props {
  meta: MetaPaginacion
  alCambiar: (pagina: number) => void
  deshabilitado?: boolean
}

/** Usa el "meta" que devuelve el backend en las listas paginadas */
export default function Paginacion({ meta, alCambiar, deshabilitado }: Props) {
  const { total, pagina, por_pagina, total_paginas } = meta
  if (total === 0) return null

  const desde = (pagina - 1) * por_pagina + 1
  const hasta = Math.min(pagina * por_pagina, total)

  // Hasta 5 números alrededor de la página actual
  const inicio = Math.max(1, Math.min(pagina - 2, total_paginas - 4))
  const fin = Math.min(total_paginas, inicio + 4)
  const paginas = Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i)

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
      <small className="text-body-secondary numeros-tabulares">
        Mostrando {desde}–{hasta} de {total}
      </small>

      {total_paginas > 1 && (
        <Pagination size="sm" className="mb-0">
          <Pagination.Prev
            disabled={deshabilitado || pagina <= 1}
            onClick={() => alCambiar(pagina - 1)}
            aria-label="Página anterior"
          />
          {paginas.map((numero) => (
            <Pagination.Item key={numero} active={numero === pagina} disabled={deshabilitado} onClick={() => alCambiar(numero)}>
              {numero}
            </Pagination.Item>
          ))}
          <Pagination.Next
            disabled={deshabilitado || pagina >= total_paginas}
            onClick={() => alCambiar(pagina + 1)}
            aria-label="Página siguiente"
          />
        </Pagination>
      )}
    </div>
  )
}
