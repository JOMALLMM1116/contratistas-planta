import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import { alcanceDe } from '../../shared/seguridad/alcance.js';
import * as empresasService from './empresas-contratistas.service.js';
import {
  actualizarEmpresaSchema,
  crearEmpresaSchema,
  empresaIdSchema,
  listarEmpresasSchema,
} from './empresas-contratistas.schemas.js';

// Consultar queda limitado al alcance del usuario (SEG-01); escribir exige permisos de personal interno

export async function listar(req: Request, res: Response) {
  const filtros = listarEmpresasSchema.parse(req.query);
  const { datos, total } = await empresasService.listar(filtros, alcanceDe(req.usuario));
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = empresaIdSchema.parse(req.params);
  res.json({ datos: await empresasService.obtener(id, alcanceDe(req.usuario)) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearEmpresaSchema.parse(req.body);
  res.status(201).json({ datos: await empresasService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = empresaIdSchema.parse(req.params);
  const datos = actualizarEmpresaSchema.parse(req.body);
  res.json({ datos: await empresasService.actualizar(id, datos) });
}

export async function desactivar(req: Request, res: Response) {
  const { id } = empresaIdSchema.parse(req.params);
  res.json({ datos: await empresasService.desactivar(id) });
}
