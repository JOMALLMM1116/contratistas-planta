import type { Response } from 'express';
import { env } from '../config/env.js';

export const COOKIE_ACCESS = 'cp_access';
export const COOKIE_REFRESH = 'cp_refresh';

// HttpOnly: JavaScript no puede leerlas (protege contra robo por XSS)
// SameSite=Strict: otro sitio no puede enviarlas (protege contra CSRF)
// Secure: solo por HTTPS, activado en produccion
const base = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

export function ponerCookiesSesion(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(COOKIE_ACCESS, accessToken, {
    ...base,
    path: '/',
    maxAge: env.ACCESS_TOKEN_MINUTOS * 60 * 1000,
  });
  // El refresh solo viaja a /api/auth: no se expone en el resto de peticiones
  res.cookie(COOKIE_REFRESH, refreshToken, {
    ...base,
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000,
  });
}

export function borrarCookiesSesion(res: Response) {
  res.clearCookie(COOKIE_ACCESS, { ...base, path: '/' });
  res.clearCookie(COOKIE_REFRESH, { ...base, path: '/api/auth' });
}
