import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import { alcanceDe } from '../../shared/seguridad/alcance.js';
import * as contratistasService from './contratistas.service.js';
import {
  actualizarContratistaSchema,
  contratistaIdSchema,
  crearContratistaSchema,
  listarContratistasSchema,
} from './contratistas.schemas.js';

// Consultar queda limitado al alcance del usuario (SEG-01); escribir exige permisos de personal interno

export async function listar(req: Request, res: Response) {
  const filtros = listarContratistasSchema.parse(req.query);
  const { datos, total } = await contratistasService.listar(filtros, alcanceDe(req.usuario));
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = contratistaIdSchema.parse(req.params);
  res.json({ datos: await contratistasService.obtener(id, alcanceDe(req.usuario)) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearContratistaSchema.parse(req.body);
  res.status(201).json({ datos: await contratistasService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = contratistaIdSchema.parse(req.params);
  const datos = actualizarContratistaSchema.parse(req.body);
  res.json({ datos: await contratistasService.actualizar(id, datos) });
}

export async function desactivar(req: Request, res: Response) {
  const { id } = contratistaIdSchema.parse(req.params);
  res.json({ datos: await contratistasService.desactivar(id) });
}
