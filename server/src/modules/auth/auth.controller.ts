import type { Request, Response } from 'express';
import { COOKIE_REFRESH, borrarCookiesSesion, ponerCookiesSesion } from '../../shared/seguridad/cookies.js';
import * as authService from './auth.service.js';
import { cambiarPasswordSchema, loginSchema, recuperarSchema, restablecerSchema } from './auth.schemas.js';

// Los tokens viajan solo en cookies HttpOnly; el cuerpo devuelve el perfil
export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const resultado = await authService.login(email, password, req);
  ponerCookiesSesion(res, resultado.accessToken, resultado.refreshToken);
  res.json({ datos: { usuario: resultado.perfil } });
}

export async function refresh(req: Request, res: Response) {
  const resultado = await authService.renovar(req.cookies?.[COOKIE_REFRESH], req);
  ponerCookiesSesion(res, resultado.accessToken, resultado.refreshToken);
  res.json({ datos: { usuario: resultado.perfil } });
}

export async function logout(req: Request, res: Response) {
  await authService.cerrarSesion(req.cookies?.[COOKIE_REFRESH], req);
  borrarCookiesSesion(res);
  res.json({ datos: { mensaje: 'Sesion cerrada' } });
}

export async function yo(req: Request, res: Response) {
  res.json({ datos: await authService.perfil(req.usuario!.id) });
}

export async function recuperar(req: Request, res: Response) {
  const { email } = recuperarSchema.parse(req.body);
  await authService.solicitarRecuperacion(email, req);
  // Mismo mensaje exista o no el correo
  res.json({ datos: { mensaje: 'Si el correo esta registrado, recibira un enlace para restablecer la contrasena' } });
}

export async function restablecer(req: Request, res: Response) {
  const { token, password } = restablecerSchema.parse(req.body);
  await authService.restablecerPassword(token, password, req);
  borrarCookiesSesion(res);
  res.json({ datos: { mensaje: 'Contrasena actualizada; inicie sesion con la nueva contrasena' } });
}

export async function cambiarPassword(req: Request, res: Response) {
  const { actual, nueva } = cambiarPasswordSchema.parse(req.body);
  await authService.cambiarPassword(req.usuario!.id, actual, nueva, req);
  borrarCookiesSesion(res);
  res.json({ datos: { mensaje: 'Contrasena actualizada; inicie sesion nuevamente' } });
}
