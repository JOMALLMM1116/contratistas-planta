import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as notificacionesService from './notificaciones.service.js';
import { ejecutarRevision } from './notificaciones.revision.js';
import { listarNotificacionesSchema, notificacionIdSchema } from './notificaciones.schemas.js';

// Cada usuario solo ve y marca SUS notificaciones: el usuario sale de la sesion

export async function listar(req: Request, res: Response) {
  const filtros = listarNotificacionesSchema.parse({ ...req.query, usuario_id: req.usuario!.id });
  const { datos, total } = await notificacionesService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function conteo(req: Request, res: Response) {
  res.json({ datos: await notificacionesService.contarNoLeidas(req.usuario!.id) });
}

export async function marcarLeida(req: Request, res: Response) {
  const { id } = notificacionIdSchema.parse(req.params);
  res.json({ datos: await notificacionesService.marcarLeida(id, req.usuario!.id) });
}

export async function marcarTodasLeidas(req: Request, res: Response) {
  res.json({ datos: await notificacionesService.marcarTodasLeidas(req.usuario!.id) });
}

// Ejecuta a mano la misma revision que corre el cron
export async function revision(_req: Request, res: Response) {
  res.json({ datos: await ejecutarRevision() });
}
