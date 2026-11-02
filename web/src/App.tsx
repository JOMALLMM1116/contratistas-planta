import { Route, Routes } from 'react-router-dom'
import RutaProtegida from './sesion/RutaProtegida'
import Layout from './layout/Layout'
import LoginPagina from './modulos/auth/LoginPagina'
import InicioPagina from './modulos/inicio/InicioPagina'
import PaginaNoEncontrada from './componentes/PaginaNoEncontrada'
import IncidentesPagina from './modulos/incidentes/IncidentesPagina'

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<LoginPagina />} />

      {/* Con sesión, dentro del layout (barra lateral + encabezado) */}
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<InicioPagina />} />
          <Route path="/incidentes" element={<RutaProtegida permisos={['incidentes.gestionar', 'incidentes.reportar']}><IncidentesPagina /></RutaProtegida>} />
          <Route path="*" element={<PaginaNoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  )
}
