import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as notificacionesService from './notificaciones.service.js';
import { ejecutarRevision } from './notificaciones.revision.js';
import { listarNotificacionesSchema, notificacionIdSchema, usuarioSchema } from './notificaciones.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarNotificacionesSchema.parse(req.query);
  const { datos, total } = await notificacionesService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function conteo(req: Request, res: Response) {
  const { usuario_id } = usuarioSchema.parse(req.query);
  res.json({ datos: await notificacionesService.contarNoLeidas(usuario_id) });
}

export async function marcarLeida(req: Request, res: Response) {
  const { id } = notificacionIdSchema.parse(req.params);
  const { usuario_id } = usuarioSchema.parse(req.body);
  res.json({ datos: await notificacionesService.marcarLeida(id, usuario_id) });
}

export async function marcarTodasLeidas(req: Request, res: Response) {
  const { usuario_id } = usuarioSchema.parse(req.body);
  res.json({ datos: await notificacionesService.marcarTodasLeidas(usuario_id) });
}

// Ejecuta a mano la misma revision que corre el cron
export async function revision(_req: Request, res: Response) {
  res.json({ datos: await ejecutarRevision() });
}