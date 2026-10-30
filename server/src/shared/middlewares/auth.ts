import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { COOKIE_ACCESS } from '../seguridad/cookies.js';
import { verificarAccessToken } from '../seguridad/tokens.js';
import { registrarAuditoria } from '../auditoria.js';

// Exige sesion valida y deja el usuario en req.usuario
export const requiereAuth: RequestHandler = async (req, _res, next) => {
  const token: string | undefined = req.cookies?.[COOKIE_ACCESS];
  if (!token) {
    return next(new AppError(401, 'NO_AUTENTICADO', 'Debe iniciar sesion'));
  }
  req.usuario = await verificarAccessToken(token);
  next();
};

// Exige al menos uno de los permisos indicados (codigos de la tabla permisos).
// Cada intento denegado queda en la auditoria.
export function requierePermiso(...codigos: string[]): RequestHandler {
  return async (req, _res, next) => {
    if (!req.usuario) {
      return next(new AppError(401, 'NO_AUTENTICADO', 'Debe iniciar sesion'));
    }
    if (codigos.some((codigo) => req.usuario!.permisos.includes(codigo))) {
      return next();
    }
    await registrarAuditoria(req, {
      accion: 'ACCESO_DENEGADO',
      entidad: req.baseUrl,
      resultado: 'denegado',
      datos_despues: { metodo: req.method, ruta: req.originalUrl, requiere: codigos },
    });
    next(new AppError(403, 'SIN_PERMISO', 'No tiene permiso para realizar esta operacion'));
  };
}
