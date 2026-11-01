import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as auditoriaService from './auditoria.service.js';
import { historialSchema, listarAuditoriaSchema } from './auditoria.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarAuditoriaSchema.parse(req.query);
  const { datos, total } = await auditoriaService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function historial(req: Request, res: Response) {
  const filtro = historialSchema.parse(req.query);
  res.json({ datos: await auditoriaService.historial(filtro) });
}