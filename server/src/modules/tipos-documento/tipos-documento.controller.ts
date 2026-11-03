import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as tiposDocumentoService from './tipos-documento.service.js';
import {
  actualizarTipoDocumentoSchema,
  crearTipoDocumentoSchema,
  listarTiposDocumentoSchema,
  tipoDocumentoIdSchema,
} from './tipos-documento.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarTiposDocumentoSchema.parse(req.query);
  const { datos, total } = await tiposDocumentoService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = tipoDocumentoIdSchema.parse(req.params);
  res.json({ datos: await tiposDocumentoService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearTipoDocumentoSchema.parse(req.body);
  res.status(201).json({ datos: await tiposDocumentoService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = tipoDocumentoIdSchema.parse(req.params);
  const datos = actualizarTipoDocumentoSchema.parse(req.body);
  res.json({ datos: await tiposDocumentoService.actualizar(id, datos) });
}

export async function eliminar(req: Request, res: Response) {
  const { id } = tipoDocumentoIdSchema.parse(req.params);
  res.json({ datos: await tiposDocumentoService.eliminar(id) });
}