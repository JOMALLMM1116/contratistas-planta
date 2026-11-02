import './shared/config/zod.js';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './shared/logger.js';
import { corsOrigins } from './shared/config/env.js';
import { apiRouter } from './routes.js';
import { errorHandler, notFound } from './shared/middlewares/error-handler.js';

// Build de la Web (web/dist). La ruta relativa es la misma en desarrollo
// (server/src/app.ts) y en la imagen Docker (/app/server/dist/app.js).
const DIRECTORIO_WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');

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
      // No ensuciar el log: health check (Docker, monitoreo) y archivos estaticos de la Web
      autoLogging: {
        ignore: (req) => req.url === '/api/health' || (req.url?.startsWith('/assets/') ?? false),
      },
    }),
  );

  app.use(helmet());
  app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : false, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', apiRouter);
  app.use('/api', notFound);

  // Aplicacion Web en / (la PWA ira en /pwa)
  servirWeb(app);

  app.use(errorHandler);

  return app;
}

function servirWeb(app: Express) {
  const indexHtml = path.join(DIRECTORIO_WEB, 'index.html');

  // Sin build (por ejemplo, en desarrollo sin haber corrido "npm --prefix web run build")
  if (!existsSync(indexHtml)) {
    logger.warn({ directorio: DIRECTORIO_WEB }, 'No se encontro el build de la Web: solo se sirve la API');
    return;
  }

  // Archivos compilados. Los de /assets llevan un hash en el nombre: se pueden guardar un año en cache
  app.use(
    express.static(DIRECTORIO_WEB, {
      index: false,
      setHeaders: (res, rutaArchivo) => {
        if (rutaArchivo.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  // Rutas de React (/login, /solicitudes, ...): siempre index.html y React Router decide la pantalla.
  // index.html sin cache para que cada despliegue se vea de inmediato.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/assets/')) return next(); // un archivo que no existe no debe devolver HTML
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });

  logger.info({ directorio: DIRECTORIO_WEB }, 'Aplicacion Web servida en /');
}
