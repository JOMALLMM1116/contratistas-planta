import { Router } from 'express';
import { env } from './shared/config/env.js';
import { prisma } from './shared/db.js';
import { zonasRouter } from './modules/zonas/zonas.routes.js';

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

