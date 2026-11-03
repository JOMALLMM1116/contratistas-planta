import { Route, Routes } from 'react-router-dom'
import RutaProtegida from './sesion/RutaProtegida'
import Layout from './layout/Layout'
import LoginPagina from './modulos/auth/LoginPagina'
import InicioPagina from './modulos/inicio/InicioPagina'
import SolicitudesPagina from './modulos/solicitudes/SolicitudesPagina'
import SolicitudDetallePagina from './modulos/solicitudes/SolicitudDetallePagina'
import NuevaSolicitudPagina from './modulos/solicitudes/NuevaSolicitudPagina'
import EmpresasPagina from './modulos/empresas/EmpresasPagina'
import AuditoriaPagina from './modulos/auditoria/AuditoriaPagina'
import PaginaNoEncontrada from './componentes/PaginaNoEncontrada'
import ContratistasPagina from './modulos/contratistas/ContratistasPagina'
import CapacitacionesPagina from './modulos/capacitaciones/CapacitacionesPagina'
import DocumentosPagina from './modulos/documentos/DocumentosPagina'

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<LoginPagina />} />

      {/* Con sesión, dentro del layout (barra lateral + encabezado) */}
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<InicioPagina />} />

          {/* Solicitudes (Manuel) */}
          <Route
            path="/solicitudes"
            element={
              <RutaProtegida permisos={['solicitudes.ver']}>
                <SolicitudesPagina />
              </RutaProtegida>
            }
          />
          <Route
            path="/solicitudes/nueva"
            element={
              <RutaProtegida permisos={['solicitudes.crear']}>
                <NuevaSolicitudPagina />
              </RutaProtegida>
            }
          />
          <Route
            path="/solicitudes/:id"
            element={
              <RutaProtegida permisos={['solicitudes.ver']}>
                <SolicitudDetallePagina />
              </RutaProtegida>
            }
          />

          {/* Empresas (Anthony) */}
          <Route
            path="/empresas"
            element={
              <RutaProtegida permisos={['empresas.gestionar']}>
                <EmpresasPagina />
              </RutaProtegida>
            }
          />

          {/* Auditoría (Anthony) */}
          <Route
            path="/auditoria"
            element={
              <RutaProtegida permisos={['auditoria.ver']}>
                <AuditoriaPagina />
              </RutaProtegida>
            }
          />

          <Route path="/contratistas" element={<RutaProtegida permisos={['contratistas.gestionar']}><ContratistasPagina /></RutaProtegida>} />
          <Route path="/documentos" element={<RutaProtegida permisos={['documentos.revisar']}><DocumentosPagina /></RutaProtegida>} />
          <Route path="/capacitaciones" element={<RutaProtegida permisos={['documentos.revisar']}><CapacitacionesPagina /></RutaProtegida>} />
          <Route path="*" element={<PaginaNoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  )
}
