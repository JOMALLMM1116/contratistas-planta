import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as capacitacionesService from './capacitaciones.service.js';
import {
  actualizarCapacitacionSchema,
  capacitacionIdSchema,
  crearCapacitacionSchema,
  listarCapacitacionesSchema,
} from './capacitaciones.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarCapacitacionesSchema.parse(req.query);
  const { datos, total } = await capacitacionesService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = capacitacionIdSchema.parse(req.params);
  res.json({ datos: await capacitacionesService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearCapacitacionSchema.parse(req.body);
  res.status(201).json({ datos: await capacitacionesService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = capacitacionIdSchema.parse(req.params);
  const datos = actualizarCapacitacionSchema.parse(req.body);
  res.json({ datos: await capacitacionesService.actualizar(id, datos) });
}

export async function eliminar(req: Request, res: Response) {
  const { id } = capacitacionIdSchema.parse(req.params);
  res.json({ datos: await capacitacionesService.eliminar(id) });
}