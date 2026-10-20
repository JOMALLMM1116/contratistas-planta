import { Router } from 'express';
import { env } from './shared/config/env.js';

// Aqui se montaran los routers de cada modulo (auth, empresas, solicitudes, ...)
export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    estado: 'ok',
    servicio: 'contratistas-planta',
    entorno: env.NODE_ENV,
    uptimeSegundos: Math.round(process.uptime()),
    fecha: new Date().toISOString(),
  });
});
