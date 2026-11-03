import { lazy, Suspense } from 'react'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { Cargando } from '../../componentes/EstadosPantalla'
import Bienvenida from './Bienvenida'

// El dashboard usa Recharts (librería pesada): solo se descarga para quien lo ve
const DashboardInicio = lazy(() => import('./DashboardInicio'))

// Con reportes.ver: panel con datos de /api/reportes/dashboard. Sin él: bienvenida con sus accesos.
export default function InicioPagina() {
  const { perfil } = useSesion()
  if (!perfil) return null

  return tienePermiso(perfil, 'reportes.ver') ? (
    <Suspense fallback={<Cargando />}>
      <DashboardInicio />
    </Suspense>
  ) : (
    <Bienvenida perfil={perfil} />
  )
}
