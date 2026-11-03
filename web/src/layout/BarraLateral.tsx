import { NavLink } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useSesion } from '../sesion/contexto'
import { tienePermiso } from '../sesion/permisos'
import { MENU } from './menu'

interface Props {
  /** Se llama al elegir una opción (en celular cierra el panel) */
  alNavegar?: () => void
}

export default function BarraLateral({ alNavegar }: Props) {
  const { perfil } = useSesion()

  // Solo las opciones permitidas; los grupos vacíos no se muestran
  const grupos = MENU.map((grupo) => ({
    ...grupo,
    opciones: grupo.opciones.filter((opcion) => !opcion.permisos || tienePermiso(perfil, ...opcion.permisos)),
  })).filter((grupo) => grupo.opciones.length > 0)

  return (
    <nav className="barra" aria-label="Menú principal">
      <div className="barra__marca">
        <ShieldCheck size={24} strokeWidth={1.75} />
        <span>Control Planta</span>
      </div>

      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="barra__grupo">
          <div className="barra__titulo">{grupo.titulo}</div>
          <ul className="list-unstyled mb-0">
            {grupo.opciones.map((opcion) => {
              const Icono = opcion.icono
              return (
                <li key={opcion.ruta}>
                  <NavLink
                    to={opcion.ruta}
                    end={opcion.exacta}
                    onClick={alNavegar}
                    className={({ isActive }) => `barra__enlace${isActive ? ' activo' : ''}`}
                  >
                    <Icono size={19} />
                    <span>{opcion.etiqueta}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
