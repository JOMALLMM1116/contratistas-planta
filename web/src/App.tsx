import { Route, Routes } from 'react-router-dom'
import RutaProtegida from './sesion/RutaProtegida'
import Layout from './layout/Layout'
import PaginaNoEncontrada from './componentes/PaginaNoEncontrada'

// Generales
import LoginPagina from './modulos/auth/LoginPagina'
import InicioPagina from './modulos/inicio/InicioPagina'

// Operación y garita (Manuel)
import SolicitudesPagina from './modulos/solicitudes/SolicitudesPagina'
import NuevaSolicitudPagina from './modulos/solicitudes/NuevaSolicitudPagina'
import SolicitudDetallePagina from './modulos/solicitudes/SolicitudDetallePagina'
import GaritaPagina from './modulos/garita/GaritaPagina'

// Personal, cumplimiento, seguridad y administración (Anthony)
import EmpresasPagina from './modulos/empresas/EmpresasPagina'
import ContratistasPagina from './modulos/contratistas/ContratistasPagina'
import DocumentosPagina from './modulos/documentos/DocumentosPagina'
import CapacitacionesPagina from './modulos/capacitaciones/CapacitacionesPagina'
import IncidentesPagina from './modulos/incidentes/IncidentesPagina'
import BloqueosPagina from './modulos/bloqueos/BloqueosPagina'
import AuditoriaPagina from './modulos/auditoria/AuditoriaPagina'
import UsuariosPagina from './modulos/usuarios/UsuariosPagina'

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<LoginPagina />} />

      {/* Con sesión, dentro del layout (barra lateral + encabezado) */}
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<InicioPagina />} />

          {/* ===== Operación ===== */}
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

          {/* ===== Garita ===== */}
          <Route
            path="/garita"
            element={
              <RutaProtegida permisos={['garita.validar']}>
                <GaritaPagina />
              </RutaProtegida>
            }
          />

          {/* ===== Personal ===== */}
          <Route
            path="/empresas"
            element={
              <RutaProtegida permisos={['empresas.gestionar']}>
                <EmpresasPagina />
              </RutaProtegida>
            }
          />
          <Route
            path="/contratistas"
            element={
              <RutaProtegida permisos={['contratistas.gestionar']}>
                <ContratistasPagina />
              </RutaProtegida>
            }
          />

          {/* ===== Cumplimiento ===== */}
          <Route
            path="/documentos"
            element={
              <RutaProtegida permisos={['documentos.revisar']}>
                <DocumentosPagina />
              </RutaProtegida>
            }
          />
          <Route
            path="/capacitaciones"
            element={
              <RutaProtegida permisos={['documentos.revisar']}>
                <CapacitacionesPagina />
              </RutaProtegida>
            }
          />

          {/* ===== Seguridad ===== */}
          <Route
            path="/incidentes"
            element={
              <RutaProtegida permisos={['incidentes.gestionar', 'incidentes.reportar']}>
                <IncidentesPagina />
              </RutaProtegida>
            }
          />
          <Route
            path="/bloqueos"
            element={
              <RutaProtegida permisos={['bloqueos.gestionar']}>
                <BloqueosPagina />
              </RutaProtegida>
            }
          />

          {/* ===== Administración ===== */}
          <Route
            path="/auditoria"
            element={
              <RutaProtegida permisos={['auditoria.ver']}>
                <AuditoriaPagina />
              </RutaProtegida>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RutaProtegida permisos={['usuarios.gestionar']}>
                <UsuariosPagina />
              </RutaProtegida>
            }
          />

          <Route path="*" element={<PaginaNoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  )
}
