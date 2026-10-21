import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';

// Cualquier ruta /api que no exista
export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', `No existe ${req.method} ${req.originalUrl}`));
};

type ErrorTraducido = { status: number; code: string; message: string; detalles?: unknown };

// Errores conocidos de Prisma / PostgreSQL convertidos a respuestas claras
function traducirErrorBaseDatos(err: unknown): ErrorTraducido | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as { name?: string; code?: string; message?: string };

  if (e.name === 'PrismaClientKnownRequestError') {
    switch (e.code) {
      case 'P2002':
        return { status: 409, code: 'REGISTRO_DUPLICADO', message: 'Ya existe un registro con ese valor unico' };
      case 'P2003':
        return { status: 409, code: 'REFERENCIA_INVALIDA', message: 'El registro hace referencia a otro que no existe o esta en uso' };
      case 'P2025':
        return { status: 404, code: 'NO_ENCONTRADO', message: 'El registro no existe' };
      case 'P2004':
        return { status: 400, code: 'RESTRICCION_VIOLADA', message: 'Los datos no cumplen una regla de la base de datos' };
    }
  }

  // Violacion de un CHECK de PostgreSQL que llega sin codigo de Prisma
  if (e.message?.includes('check constraint')) {
    return { status: 400, code: 'RESTRICCION_VIOLADA', message: 'Los datos no cumplen una regla de la base de datos' };
  }

  return null;
}

// Manejador central: todas las respuestas de error tienen el mismo formato
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let resultado: ErrorTraducido = { status: 500, code: 'ERROR_INTERNO', message: 'Ocurrio un error inesperado' };

  if (err instanceof AppError) {
    resultado = { status: err.status, code: err.code, message: err.message, detalles: err.detalles };
  } else if (err instanceof ZodError) {
    resultado = {
      status: 400,
      code: 'VALIDACION',
      message: 'Los datos enviados no son validos',
      detalles: err.issues.map((issue) => ({ campo: issue.path.map(String).join('.'), mensaje: issue.message })),
    };
  } else if (err?.type === 'entity.parse.failed') {
    resultado = { status: 400, code: 'JSON_INVALIDO', message: 'El cuerpo de la peticion no es un JSON valido' };
  } else {
    resultado = traducirErrorBaseDatos(err) ?? resultado;
  }

  const { status, code, message, detalles } = resultado;

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
