import { AppError } from '../errors/app-error.js';
import type { UsuarioSesion } from './tokens.js';

/**
 * Autorización por objeto (OWASP A01): además del permiso de la acción,
 * qué registros puede ver el usuario.
 *
 * - interno:      personal de la planta; ve todo según sus permisos
 * - empresa:      usuario externo de una empresa (supervisor de campo); solo su empresa
 * - contratista:  usuario externo con ficha de contratista; solo lo suyo
 * - ninguno:      externo mal configurado o sin sesión; no ve nada (falla cerrado)
 */
export type Alcance =
  | { tipo: 'interno' }
  | { tipo: 'empresa'; empresaId: string }
  | { tipo: 'contratista'; contratistaId: string }
  | { tipo: 'ninguno' };

export function alcanceDe(usuario: UsuarioSesion | undefined): Alcance {
  if (!usuario) return { tipo: 'ninguno' };
  if (usuario.es_interno) return { tipo: 'interno' };
  if (usuario.contratista_id) return { tipo: 'contratista', contratistaId: usuario.contratista_id };
  if (usuario.empresa_id) return { tipo: 'empresa', empresaId: usuario.empresa_id };
  return { tipo: 'ninguno' };
}

/**
 * Respuesta cuando el registro existe pero no pertenece al usuario.
 * Se responde 404 (y no 403) para no revelar que el registro existe.
 */
export function fueraDeAlcance(codigo: string, mensaje: string): AppError {
  return new AppError(404, codigo, mensaje);
}
