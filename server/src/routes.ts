import { Router } from 'express';
import { env } from './shared/config/env.js';
import { prisma } from './shared/db.js';
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

export const apiRouter = Router();

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

// ---- Modulos (una linea por modulo) ----
apiRouter.use('/zonas', zonasRouter);
apiRouter.use('/tipos-trabajo', tiposTrabajoRouter);
apiRouter.use('/tipos-documento', tiposDocumentoRouter);
apiRouter.use('/capacitaciones', capacitacionesRouter);
apiRouter.use('/requisitos-tipo-trabajo', requisitosRouter);
apiRouter.use('/checklist-plantillas', checklistPlantillasRouter);
apiRouter.use('/empresas-contratistas', empresasRouter);
apiRouter.use('/contratistas', contratistasRouter);
apiRouter.use('/equipos', equiposRouter);
apiRouter.use('/archivos', archivosRouter);
apiRouter.use('/solicitudes', solicitudesRouter);
apiRouter.use('/documentos', documentosRouter);
apiRouter.use('/contratista-capacitaciones', contratistaCapacitacionesRouter);
