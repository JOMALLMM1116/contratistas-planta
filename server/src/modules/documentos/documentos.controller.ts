import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as documentosService from './documentos.service.js';
import {
  actualizarDocumentoSchema,
  crearDocumentoSchema,
  documentoIdSchema,
  listarDocumentosSchema,
  revisarDocumentoSchema,
} from './documentos.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarDocumentosSchema.parse(req.query);
  const { datos, total } = await documentosService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = documentoIdSchema.parse(req.params);
  res.json({ datos: await documentosService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearDocumentoSchema.parse(req.body);
  res.status(201).json({ datos: await documentosService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = documentoIdSchema.parse(req.params);
  const datos = actualizarDocumentoSchema.parse(req.body);
  res.json({ datos: await documentosService.actualizar(id, datos) });
}

export async function revisar(req: Request, res: Response) {
  const { id } = documentoIdSchema.parse(req.params);
  // Quien revisa sale de la sesion, nunca del cuerpo de la peticion
  const datos = revisarDocumentoSchema.parse({ ...req.body, revisado_por: req.usuario!.id });
  res.json({ datos: await documentosService.revisar(id, datos) });
}

export async function eliminar(req: Request, res: Response) {
  const { id } = documentoIdSchema.parse(req.params);
  res.json({ datos: await documentosService.eliminar(id) });
}
