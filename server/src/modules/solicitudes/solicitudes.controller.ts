import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as solicitudesService from './solicitudes.service.js';
import {
  actualizarSolicitudSchema,
  autorizarSolicitudSchema,
  cancelarSolicitudSchema,
  crearSolicitudSchema,
  enviarSolicitudSchema,
  evaluarSolicitudSchema,
  listarSolicitudesSchema,
  solicitudIdSchema,
} from './solicitudes.schemas.js';

// En cada accion, el usuario responsable se toma de la sesion (req.usuario)
// y reemplaza cualquier valor que venga en el cuerpo de la peticion.

export async function listar(req: Request, res: Response) {
  const filtros = listarSolicitudesSchema.parse(req.query);
  const { datos, total } = await solicitudesService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  res.json({ datos: await solicitudesService.obtener(id) });
}

export async function requisitos(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  res.json({ datos: await solicitudesService.requisitos(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearSolicitudSchema.parse({ ...req.body, solicitada_por: req.usuario!.id });
  res.status(201).json({ datos: await solicitudesService.crear(datos) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = actualizarSolicitudSchema.parse(req.body);
  res.json({ datos: await solicitudesService.actualizar(id, datos) });
}

export async function enviar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = enviarSolicitudSchema.parse({ ...(req.body ?? {}), usuario_id: req.usuario!.id });
  res.json({ datos: await solicitudesService.enviar(id, datos) });
}

export async function evaluar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = evaluarSolicitudSchema.parse({ ...req.body, evaluador_id: req.usuario!.id });
  res.status(201).json({ datos: await solicitudesService.evaluar(id, datos) });
}

export async function autorizar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = autorizarSolicitudSchema.parse({ ...req.body, usuario_id: req.usuario!.id });
  res.status(201).json({ datos: await solicitudesService.autorizar(id, datos) });
}

export async function cancelar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = cancelarSolicitudSchema.parse({ ...req.body, usuario_id: req.usuario!.id });
  res.json({ datos: await solicitudesService.cancelar(id, datos) });
}

export async function eliminar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  res.json({ datos: await solicitudesService.eliminar(id) });
}
