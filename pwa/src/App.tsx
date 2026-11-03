import { Navigate, Route, Routes } from 'react-router-dom'
import RutaProtegida from './sesion/RutaProtegida'
import LayoutApp from './layout/LayoutApp'
import LoginPagina from './modulos/auth/LoginPagina'
import MiCredencialPagina from './modulos/credencial/MiCredencialPagina'
import MisSolicitudesPagina from './modulos/solicitudes/MisSolicitudesPagina'
import CuentaPagina from './modulos/cuenta/CuentaPagina'

// Rutas de la PWA (todas bajo /pwa por el basename del router)
export default function App() {
  return (
    <Routes>
      {/* Pública */}
      <Route path="/login" element={<LoginPagina />} />

      {/* Con sesión de contratista o supervisor, dentro de la app con barra inferior */}
      <Route element={<RutaProtegida />}>
        <Route element={<LayoutApp />}>
          <Route path="/" element={<MiCredencialPagina />} />
          <Route path="/solicitudes" element={<MisSolicitudesPagina />} />
          <Route path="/cuenta" element={<CuentaPagina />} />
        </Route>
      </Route>

      {/* Cualquier otra ruta vuelve al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
