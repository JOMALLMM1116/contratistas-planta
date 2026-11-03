import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Offcanvas } from 'react-bootstrap'
import BarraLateral from './BarraLateral'
import Encabezado from './Encabezado'
import './layout.css'

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const cerrarMenu = () => setMenuAbierto(false)

  return (
    <div className="layout">
      {/* responsive="lg": panel deslizable en celular/tablet, barra fija desde 992 px */}
      <aside className="layout__barra">
        <Offcanvas show={menuAbierto} onHide={cerrarMenu} responsive="lg" className="layout__offcanvas">
          <Offcanvas.Header closeButton closeVariant="white" />
          <Offcanvas.Body className="p-0">
            <BarraLateral alNavegar={cerrarMenu} />
          </Offcanvas.Body>
        </Offcanvas>
      </aside>

      <div className="layout__principal">
        <Encabezado alAbrirMenu={() => setMenuAbierto(true)} />
        <main className="layout__contenido">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
