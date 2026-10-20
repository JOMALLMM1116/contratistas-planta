import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './shared/logger.js';
import { corsOrigins } from './shared/config/env.js';
import { apiRouter } from './routes.js';
import { errorHandler, notFound } from './shared/middlewares/error-handler.js';

export function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  // En produccion la app queda detras de nginx: necesario para la IP real y el rate limit
  app.set('trust proxy', 1);

  // Log de cada peticion con un id unico (tambien se devuelve en la cabecera x-request-id)
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      // Solo lo necesario: sin cabeceras completas
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.remoteAddress }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      // 4xx como advertencia, 5xx como error
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      // El health check se consulta seguido (Docker, monitoreo): no ensuciar el log
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );

  app.use(helmet());
  app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : false, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', apiRouter);
  app.use('/api', notFound);

  // Mas adelante aqui se sirven los builds de la Web (/) y la PWA (/pwa)

  app.use(errorHandler);

  return app;
}
