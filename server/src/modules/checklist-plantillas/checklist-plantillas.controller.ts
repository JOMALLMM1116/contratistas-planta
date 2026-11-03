import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as plantillasService from './checklist-plantillas.service.js';
import {
  actualizarItemSchema,
  actualizarPlantillaSchema,
  crearItemSchema,
  crearPlantillaSchema,
  itemParamsSchema,
  listarPlantillasSchema,
  plantillaIdSchema,
} from './checklist-plantillas.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarPlantillasSchema.parse(req.query);
  const { datos, total } = await plantillasService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = plantillaIdSchema.parse(req.params);
  res.json({ datos: await plantillasService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearPlantillaSchema.parse(req.body);
  res.status(201).json({ datos: await plantillasService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = plantillaIdSchema.parse(req.params);
  const datos = actualizarPlantillaSchema.parse(req.body);
  res.json({ datos: await plantillasService.actualizar(id, datos) });
}

export async function desactivar(req: Request, res: Response) {
  const { id } = plantillaIdSchema.parse(req.params);
  res.json({ datos: await plantillasService.desactivar(id) });
}

export async function agregarItem(req: Request, res: Response) {
  const { id } = plantillaIdSchema.parse(req.params);
  const datos = crearItemSchema.parse(req.body);
  res.status(201).json({ datos: await plantillasService.agregarItem(id, datos) });
}

export async function actualizarItem(req: Request, res: Response) {
  const { id, itemId } = itemParamsSchema.parse(req.params);
  const datos = actualizarItemSchema.parse(req.body);
  res.json({ datos: await plantillasService.actualizarItem(id, itemId, datos) });
}

export async function eliminarItem(req: Request, res: Response) {
  const { id, itemId } = itemParamsSchema.parse(req.params);
  res.json({ datos: await plantillasService.eliminarItem(id, itemId) });
}