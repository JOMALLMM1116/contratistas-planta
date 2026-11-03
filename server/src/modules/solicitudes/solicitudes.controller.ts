import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import { alcanceDe } from '../../shared/seguridad/alcance.js';
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
// Ademas se pasa su alcance: un usuario externo solo opera sobre lo suyo (SEG-01).

export async function listar(req: Request, res: Response) {
  const filtros = listarSolicitudesSchema.parse(req.query);
  const { datos, total } = await solicitudesService.listar(filtros, alcanceDe(req.usuario));
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  res.json({ datos: await solicitudesService.obtener(id, alcanceDe(req.usuario)) });
}

export async function requisitos(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  res.json({ datos: await solicitudesService.requisitos(id, alcanceDe(req.usuario)) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearSolicitudSchema.parse({ ...req.body, solicitada_por: req.usuario!.id });
  res.status(201).json({ datos: await solicitudesService.crear(datos, alcanceDe(req.usuario)) });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = actualizarSolicitudSchema.parse(req.body);
  res.json({ datos: await solicitudesService.actualizar(id, datos, alcanceDe(req.usuario)) });
}

export async function enviar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = enviarSolicitudSchema.parse({ ...(req.body ?? {}), usuario_id: req.usuario!.id });
  res.json({ datos: await solicitudesService.enviar(id, datos, alcanceDe(req.usuario)) });
}

export async function evaluar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = evaluarSolicitudSchema.parse({ ...req.body, evaluador_id: req.usuario!.id });
  res.status(201).json({ datos: await solicitudesService.evaluar(id, datos, alcanceDe(req.usuario)) });
}

export async function autorizar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = autorizarSolicitudSchema.parse({ ...req.body, usuario_id: req.usuario!.id });
  res.status(201).json({ datos: await solicitudesService.autorizar(id, datos, alcanceDe(req.usuario)) });
}

export async function cancelar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  const datos = cancelarSolicitudSchema.parse({ ...req.body, usuario_id: req.usuario!.id });
  res.json({ datos: await solicitudesService.cancelar(id, datos, alcanceDe(req.usuario)) });
}

export async function eliminar(req: Request, res: Response) {
  const { id } = solicitudIdSchema.parse(req.params);
  res.json({ datos: await solicitudesService.eliminar(id, alcanceDe(req.usuario)) });
}
