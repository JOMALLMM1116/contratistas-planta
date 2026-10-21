import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as equiposService from './equipos.service.js';
import {
  actualizarEquipoSchema,
  crearEquipoSchema,
  equipoIdSchema,
  listarEquiposSchema,
} from './equipos.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarEquiposSchema.parse(req.query);
  const { datos, total } = await equiposService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = equipoIdSchema.parse(req.params);
  res.json({ datos: await equiposService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearEquipoSchema.parse(req.body);
  res.status(201).json({ datos: await equiposService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = equipoIdSchema.parse(req.params);
  const datos = actualizarEquipoSchema.parse(req.body);
  res.json({ datos: await equiposService.actualizar(id, datos) });
}

export async function desactivar(req: Request, res: Response) {
  const { id } = equipoIdSchema.parse(req.params);
  res.json({ datos: await equiposService.desactivar(id) });
}