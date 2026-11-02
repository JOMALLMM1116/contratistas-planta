import { Route, Routes } from 'react-router-dom'
import RutaProtegida from './sesion/RutaProtegida'
import LoginPagina from './modulos/auth/LoginPagina'
import InicioPagina from './modulos/inicio/InicioPagina'
import PaginaNoEncontrada from './componentes/PaginaNoEncontrada'

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<LoginPagina />} />

      {/* Con sesión */}
      <Route element={<RutaProtegida />}>
        <Route path="/" element={<InicioPagina />} />
      </Route>

      <Route path="*" element={<PaginaNoEncontrada />} />
    </Routes>
  )
}
