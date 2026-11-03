import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as zonasService from './zonas.service.js';
import { actualizarZonaSchema, crearZonaSchema, listarZonasSchema, zonaIdSchema } from './zonas.schemas.js';

// El controlador solo valida la entrada y arma la respuesta HTTP.
// Si Zod falla, lanza ZodError y el manejador central responde 400.

export async function listar(req: Request, res: Response) {
  const filtros = listarZonasSchema.parse(req.query);
  const { datos, total } = await zonasService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = zonaIdSchema.parse(req.params);
  res.json({ datos: await zonasService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearZonaSchema.parse(req.body);
  res.status(201).json({ datos: await zonasService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = zonaIdSchema.parse(req.params);
  const datos = actualizarZonaSchema.parse(req.body);
  res.json({ datos: await zonasService.actualizar(id, datos) });
}

export async function desactivar(req: Request, res: Response) {
  const { id } = zonaIdSchema.parse(req.params);
  res.json({ datos: await zonasService.desactivar(id) });
}
