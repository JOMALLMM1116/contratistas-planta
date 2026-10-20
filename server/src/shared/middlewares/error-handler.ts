import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';

// Cualquier ruta /api que no exista
export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', `No existe ${req.method} ${req.originalUrl}`));
};

// Manejador central: todas las respuestas de error tienen el mismo formato
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'ERROR_INTERNO';
  let message = 'Ocurrio un error inesperado';
  let detalles: unknown;

  if (err instanceof AppError) {
    ({ status, code, message, detalles } = err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'JSON_INVALIDO';
    message = 'El cuerpo de la peticion no es un JSON valido';
  }

  if (status >= 500) {
    req.log.error({ err }, 'Error no controlado');
  } else {
    req.log.warn({ code }, message);
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(detalles !== undefined ? { detalles } : {}),
      // El detalle tecnico solo se muestra fuera de produccion
      ...(status >= 500 && env.NODE_ENV !== 'production' ? { tecnico: String(err?.message ?? err) } : {}),
    },
  });
};
