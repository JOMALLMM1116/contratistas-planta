import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as requisitosService from './requisitos-tipo-trabajo.service.js';
import {
  actualizarRequisitoSchema,
  crearRequisitoSchema,
  listarRequisitosSchema,
  requisitoIdSchema,
} from './requisitos-tipo-trabajo.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarRequisitosSchema.parse(req.query);
  const { datos, total } = await requisitosService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = requisitoIdSchema.parse(req.params);
  res.json({ datos: await requisitosService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearRequisitoSchema.parse(req.body);
  res.status(201).json({ datos: await requisitosService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = requisitoIdSchema.parse(req.params);
  const datos = actualizarRequisitoSchema.parse(req.body);
  res.json({ datos: await requisitosService.actualizar(id, datos) });
}

export async function eliminar(req: Request, res: Response) {
  const { id } = requisitoIdSchema.parse(req.params);
  res.json({ datos: await requisitosService.eliminar(id) });
}