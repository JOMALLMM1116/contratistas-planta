import { SignJWT } from 'jose';
import { env } from '../../shared/config/env.js';

const SECRETO = new TextEncoder().encode(env.JWT_SECRET);
export const EMISOR = 'contratistas-planta';
// Audiencia distinta a la de las sesiones: un token de sesion nunca sirve como credencial
export const AUDIENCIA_CREDENCIAL = 'credencial';

type DatosToken = { id: string; contratista_id: string; solicitud_id: string; expira_en: Date };

// jti = id de la credencial, sub = contratista, sol = solicitud, exp = fin de la vigencia
export function firmarTokenCredencial(c: DatosToken) {
  return new SignJWT({ sol: c.solicitud_id })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(c.id)
    .setSubject(c.contratista_id)
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA_CREDENCIAL)
    .setIssuedAt()
    .setExpirationTime(Math.floor(c.expira_en.getTime() / 1000))
    .sign(SECRETO);
}

export { SECRETO as SECRETO_CREDENCIAL };

