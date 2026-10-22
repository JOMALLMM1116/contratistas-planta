import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as permisosService from './permisos-trabajo.service.js';
import {
  cerrarPermisoSchema,
  crearEvidenciaSchema,
  crearPermisoSchema,
  evidenciaParamsSchema,
  iniciarPermisoSchema,
  listarPermisosSchema,
  permisoIdSchema,
  registrarChecklistSchema,
  revocarPermisoSchema,
} from './permisos-trabajo.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarPermisosSchema.parse(req.query);
  const { datos, total } = await permisosService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = permisoIdSchema.parse(req.params);
  res.json({ datos: await permisosService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearPermisoSchema.parse(req.body);
  res.status(201).json({ datos: await permisosService.crear(datos) });
}

export async function iniciar(req: Request, res: Response) {
  const { id } = permisoIdSchema.parse(req.params);
  const datos = iniciarPermisoSchema.parse(req.body);
  res.json({ datos: await permisosService.iniciar(id, datos) });
}

export async function cerrar(req: Request, res: Response) {
  const { id } = permisoIdSchema.parse(req.params);
  const datos = cerrarPermisoSchema.parse(req.body);
  res.json({ datos: await permisosService.cerrar(id, datos) });
}

export async function revocar(req: Request, res: Response) {
  const { id } = permisoIdSchema.parse(req.params);
  const datos = revocarPermisoSchema.parse(req.body);
  res.json({ datos: await permisosService.revocar(id, datos) });
}

export async function obtenerChecklist(req: Request, res: Response) {
  const { id } = permisoIdSchema.parse(req.params);
  res.json({ datos: await permisosService.obtenerChecklist(id) });
}

export async function registrarChecklist(req: Request, res: Response) {
  const { id } = permisoIdSchema.parse(req.params);
  const datos = registrarChecklistSchema.parse(req.body);
  res.json({ datos: await permisosService.registrarChecklist(id, datos) });
}

export async function listarEvidencias(req: Request, res: Response) {
  const { id } = permisoIdSchema.parse(req.params);
  res.json({ datos: await permisosService.listarEvidencias(id) });
}

export async function agregarEvidencia(req: Request, res: Response) {
  const { id } = permisoIdSchema.parse(req.params);
  const datos = crearEvidenciaSchema.parse(req.body);
  res.status(201).json({ datos: await permisosService.agregarEvidencia(id, datos) });
}

export async function eliminarEvidencia(req: Request, res: Response) {
  const { id, evidenciaId } = evidenciaParamsSchema.parse(req.params);
  res.json({ datos: await permisosService.eliminarEvidencia(id, evidenciaId) });
}