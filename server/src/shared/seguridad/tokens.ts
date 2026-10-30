import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, errors, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

const SECRETO = new TextEncoder().encode(env.JWT_SECRET);
const EMISOR = 'contratistas-planta';
const AUDIENCIA_SESION = 'sesion';

// Lo que viaja dentro del access token y queda disponible en req.usuario
export type UsuarioSesion = {
  id: string;
  email: string;
  rol: string;
  permisos: string[];
  empresa_id: string | null;
  contratista_id: string | null;
};

export function firmarAccessToken(u: UsuarioSesion) {
  return new SignJWT({
    email: u.email,
    rol: u.rol,
    permisos: u.permisos,
    empresa_id: u.empresa_id,
    contratista_id: u.contratista_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(u.id)
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA_SESION)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_MINUTOS}m`)
    .sign(SECRETO);
}

export async function verificarAccessToken(token: string): Promise<UsuarioSesion> {
  try {
    // algorithms fijo en HS256: evita ataques que cambian el algoritmo del token
    const { payload } = await jwtVerify(token, SECRETO, {
      issuer: EMISOR,
      audience: AUDIENCIA_SESION,
      algorithms: ['HS256'],
    });
    return {
      id: payload.sub as string,
      email: payload.email as string,
      rol: payload.rol as string,
      permisos: (payload.permisos as string[] | undefined) ?? [],
      empresa_id: (payload.empresa_id as string | null | undefined) ?? null,
      contratista_id: (payload.contratista_id as string | null | undefined) ?? null,
    };
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      throw new AppError(401, 'SESION_EXPIRADA', 'La sesion expiro; renuevela con /api/auth/refresh');
    }
    throw new AppError(401, 'NO_AUTENTICADO', 'La sesion no es valida');
  }
}

// Refresh tokens: valor aleatorio para el cliente; en la base solo se guarda su hash
export function generarTokenAleatorio() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
