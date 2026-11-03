import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import { alcanceDe } from '../../shared/seguridad/alcance.js';
import * as registrosService from './contratista-capacitaciones.service.js';
import {
  actualizarRegistroSchema,
  crearRegistroSchema,
  listarRegistrosSchema,
  registroIdSchema,
  revisarRegistroSchema,
} from './contratista-capacitaciones.schemas.js';

// Un usuario externo solo ve y gestiona capacitaciones de su alcance (SEG-01)

export async function listar(req: Request, res: Response) {
  const filtros = listarRegistrosSchema.parse(req.query);
  const { datos, total } = await registrosService.listar(filtros, alcanceDe(req.usuario));
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = registroIdSchema.parse(req.params);
  res.json({ datos: await registrosService.obtener(id, alcanceDe(req.usuario)) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearRegistroSchema.parse(req.body);
  res.status(201).json({ datos: await registrosService.crear(datos, alcanceDe(req.usuario), req.usuario!.id) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = registroIdSchema.parse(req.params);
  const datos = actualizarRegistroSchema.parse(req.body);
  res.json({ datos: await registrosService.actualizar(id, datos, alcanceDe(req.usuario), req.usuario!.id) });
}

export async function revisar(req: Request, res: Response) {
  const { id } = registroIdSchema.parse(req.params);
  // Quien revisa sale de la sesion, nunca del cuerpo de la peticion
  const datos = revisarRegistroSchema.parse({ ...req.body, revisado_por: req.usuario!.id });
  res.json({ datos: await registrosService.revisar(id, datos, alcanceDe(req.usuario)) });
}

export async function eliminar(req: Request, res: Response) {
  const { id } = registroIdSchema.parse(req.params);
  res.json({ datos: await registrosService.eliminar(id, alcanceDe(req.usuario)) });
}
