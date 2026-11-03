import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, QrCode, UserRound } from 'lucide-react'
import BotonTema from '../componentes/BotonTema'
import './layout.css'

// Opciones de la barra inferior (tipo app móvil)
const OPCIONES = [
  { ruta: '/', texto: 'Mi credencial', icono: QrCode },
  { ruta: '/solicitudes', texto: 'Solicitudes', icono: ClipboardList },
  { ruta: '/cuenta', texto: 'Cuenta', icono: UserRound },
]

export default function LayoutApp() {
  return (
    <div className="cp-app">
      <header className="cp-app-encabezado">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={28} height={28} />
        <span className="fw-semibold flex-grow-1">Control Planta</span>
        <BotonTema />
      </header>

      <main className="cp-app-contenido">
        <Outlet />
      </main>

      <nav className="cp-nav-inferior" aria-label="Navegación principal">
        {OPCIONES.map(({ ruta, texto, icono: Icono }) => (
          <NavLink key={ruta} to={ruta} end>
            <Icono size={22} aria-hidden="true" />
            <span>{texto}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
