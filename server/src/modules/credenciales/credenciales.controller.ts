import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as credencialesService from './credenciales.service.js';
import {
  credencialIdSchema,
  emitirCredencialSchema,
  listarCredencialesSchema,
  revocarCredencialSchema,
} from './credenciales.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarCredencialesSchema.parse(req.query);
  const { datos, total } = await credencialesService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = credencialIdSchema.parse(req.params);
  res.json({ datos: await credencialesService.obtener(id) });
}

export async function mias(req: Request, res: Response) {
  res.json({ datos: await credencialesService.mias(req) });
}

export async function qr(req: Request, res: Response) {
  const { id } = credencialIdSchema.parse(req.params);
  res.json({ datos: await credencialesService.qr(id, req) });
}

export async function emitir(req: Request, res: Response) {
  const datos = emitirCredencialSchema.parse(req.body);
  res.status(201).json({ datos: await credencialesService.emitir(datos, req) });
}

export async function revocar(req: Request, res: Response) {
  const { id } = credencialIdSchema.parse(req.params);
  const { motivo } = revocarCredencialSchema.parse(req.body);
  res.json({ datos: await credencialesService.revocar(id, motivo, req) });
}
