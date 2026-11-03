import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import Bienvenida from './Bienvenida'
import DashboardInicio from './DashboardInicio'

// Con reportes.ver: panel con datos de /api/reportes/dashboard. Sin él: bienvenida con sus accesos.
export default function InicioPagina() {
  const { perfil } = useSesion()
  if (!perfil) return null

  return tienePermiso(perfil, 'reportes.ver') ? <DashboardInicio /> : <Bienvenida perfil={perfil} />
}