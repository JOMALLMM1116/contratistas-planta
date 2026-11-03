import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from 'react-bootstrap'
import { ClipboardCheck } from 'lucide-react'
import { api } from '../../api/cliente'
import type { RespuestaPaginada } from '../../api/tipos'
import EstadoBadge from '../../componentes/EstadoBadge'

interface PermisoResumen {
  id: string
  codigo: string
  estado: string
}

/** Enlace al permiso de trabajo de la solicitud, si ya se emitió (el backend filtra por alcance) */
export default function PermisoDeSolicitud({ solicitudId }: { solicitudId: string }) {
  const consulta = useQuery({
    queryKey: ['permiso-de-solicitud', solicitudId],
    queryFn: () =>
      api.get<RespuestaPaginada<PermisoResumen>>('/permisos-trabajo', { solicitud_id: solicitudId, por_pagina: 1 }).then((r) => r.datos[0] ?? null),
  })

  // Si no se puede consultar, no se muestra nada (el resto del detalle sigue funcionando)
  if (consulta.isPending || consulta.isError) return null
  const permiso = consulta.data

  return (
    <section className="mb-4" aria-labelledby="titulo-permiso">
      <h2 className="h6 mb-2" id="titulo-permiso">
        Permiso de trabajo
      </h2>
      {permiso ? (
        <Card>
          <Card.Body className="d-flex align-items-center justify-content-between gap-2">
            <div>
              <div className="fw-semibold numeros-tabulares mb-1">{permiso.codigo}</div>
              <EstadoBadge entidad="permiso_trabajo" estado={permiso.estado} />
            </div>
            <Link to={`/permisos-trabajo/${permiso.id}`} className="btn btn-primary d-inline-flex align-items-center gap-2">
              <ClipboardCheck size={18} aria-hidden="true" /> Abrir
            </Link>
          </Card.Body>
        </Card>
      ) : (
        <Card body>Todavía no se ha emitido el permiso de trabajo de esta solicitud.</Card>
      )}
    </section>
  )
}