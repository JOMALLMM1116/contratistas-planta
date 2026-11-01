import { Router } from 'express';
import { env } from './shared/config/env.js';
import { prisma } from './shared/db.js';
import { requiereAuth, requierePermiso, requierePermisoEscritura } from './shared/middlewares/auth.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { zonasRouter } from './modules/zonas/zonas.routes.js';
import { tiposTrabajoRouter } from './modules/tipos-trabajo/tipos-trabajo.routes.js';
import { tiposDocumentoRouter } from './modules/tipos-documento/tipos-documento.routes.js';
import { capacitacionesRouter } from './modules/capacitaciones/capacitaciones.routes.js';
import { requisitosRouter } from './modules/requisitos-tipo-trabajo/requisitos-tipo-trabajo.routes.js';
import { checklistPlantillasRouter } from './modules/checklist-plantillas/checklist-plantillas.routes.js';
import { empresasRouter } from './modules/empresas-contratistas/empresas-contratistas.routes.js';
import { contratistasRouter } from './modules/contratistas/contratistas.routes.js';
import { equiposRouter } from './modules/equipos/equipos.routes.js';
import { archivosRouter } from './modules/archivos/archivos.routes.js';
import { solicitudesRouter } from './modules/solicitudes/solicitudes.routes.js';
import { documentosRouter } from './modules/documentos/documentos.routes.js';
import { contratistaCapacitacionesRouter } from './modules/contratista-capacitaciones/contratista-capacitaciones.routes.js';
import { permisosTrabajoRouter } from './modules/permisos-trabajo/permisos-trabajo.routes.js';
import { notificacionesRouter } from './modules/notificaciones/notificaciones.routes.js';
import { reportesRouter } from './modules/reportes/reportes.routes.js';
import { credencialesRouter } from './modules/credenciales/credenciales.routes.js';
import { garitaRouter } from './modules/garita/garita.routes.js';
import { bloqueosRouter } from './modules/bloqueos/bloqueos.routes.js';

export const apiRouter = Router();

// Publico: lo usan Docker y el monitoreo
apiRouter.get('/health', async (_req, res) => {
  let baseDatos: 'ok' | 'error' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    baseDatos = 'error';
  }

  // 503 si la base no responde: Docker y el monitoreo lo detectan como servicio degradado
  res.status(baseDatos === 'ok' ? 200 : 503).json({
    estado: baseDatos === 'ok' ? 'ok' : 'degradado',
    servicio: 'contratistas-planta',
    entorno: env.NODE_ENV,
    baseDatos,
    uptimeSegundos: Math.round(process.uptime()),
    fecha: new Date().toISOString(),
  });
});

// Publico: login, refresh, logout y recuperacion de contrasena
apiRouter.use('/auth', authRouter);

// ---- De aqui en adelante TODO exige sesion ----
apiRouter.use(requiereAuth);

// Catalogos: consultar cualquiera; modificar, seguridad industrial y admin
apiRouter.use('/zonas', requierePermisoEscritura('requisitos.gestionar'), zonasRouter);
apiRouter.use('/tipos-trabajo', requierePermisoEscritura('requisitos.gestionar'), tiposTrabajoRouter);
apiRouter.use('/tipos-documento', requierePermisoEscritura('requisitos.gestionar'), tiposDocumentoRouter);
apiRouter.use('/capacitaciones', requierePermisoEscritura('requisitos.gestionar'), capacitacionesRouter);
apiRouter.use('/requisitos-tipo-trabajo', requierePermisoEscritura('requisitos.gestionar'), requisitosRouter);
apiRouter.use('/checklist-plantillas', requierePermisoEscritura('requisitos.gestionar'), checklistPlantillasRouter);

// Empresas, contratistas y equipos
apiRouter.use('/empresas-contratistas', requierePermisoEscritura('empresas.gestionar'), empresasRouter);
apiRouter.use('/contratistas', requierePermisoEscritura('contratistas.gestionar'), contratistasRouter);
apiRouter.use('/equipos', requierePermisoEscritura('contratistas.gestionar'), equiposRouter);

// Reportes: incluso consultarlos exige permiso
apiRouter.use('/reportes', requierePermiso('reportes.ver'), reportesRouter);

// Permisos por accion dentro de cada modulo
apiRouter.use('/archivos', archivosRouter);
apiRouter.use('/solicitudes', solicitudesRouter);
apiRouter.use('/documentos', documentosRouter);
apiRouter.use('/contratista-capacitaciones', contratistaCapacitacionesRouter);
apiRouter.use('/permisos-trabajo', permisosTrabajoRouter);
apiRouter.use('/notificaciones', notificacionesRouter);
apiRouter.use('/credenciales', credencialesRouter);
apiRouter.use('/garita', garitaRouter);
apiRouter.use('/bloqueos', bloqueosRouter);
