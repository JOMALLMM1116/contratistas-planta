import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as tiposTrabajoService from './tipos-trabajo.service.js';
import {
  actualizarTipoTrabajoSchema,
  crearTipoTrabajoSchema,
  listarTiposTrabajoSchema,
  tipoTrabajoIdSchema,
} from './tipos-trabajo.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarTiposTrabajoSchema.parse(req.query);
  const { datos, total } = await tiposTrabajoService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = tipoTrabajoIdSchema.parse(req.params);
  res.json({ datos: await tiposTrabajoService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearTipoTrabajoSchema.parse(req.body);
  res.status(201).json({ datos: await tiposTrabajoService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = tipoTrabajoIdSchema.parse(req.params);
  const datos = actualizarTipoTrabajoSchema.parse(req.body);
  res.json({ datos: await tiposTrabajoService.actualizar(id, datos) });
}

export async function desactivar(req: Request, res: Response) {
  const { id } = tipoTrabajoIdSchema.parse(req.params);
  res.json({ datos: await tiposTrabajoService.desactivar(id) });
}