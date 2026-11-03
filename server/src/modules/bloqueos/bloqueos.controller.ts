import type { Request, Response } from 'express';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as bloqueosService from './bloqueos.service.js';
import { bloqueoIdSchema, crearBloqueoSchema, levantarBloqueoSchema, listarBloqueosSchema } from './bloqueos.schemas.js';

// creado_por y levantado_por salen de la sesion (req.usuario), nunca del cuerpo

export async function listar(req: Request, res: Response) {
  const filtros = listarBloqueosSchema.parse(req.query);
  const { datos, total } = await bloqueosService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = bloqueoIdSchema.parse(req.params);
  res.json({ datos: await bloqueosService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearBloqueoSchema.parse({ ...req.body, creado_por: req.usuario!.id });
  const bloqueo = await bloqueosService.crear(datos);

  await registrarAuditoria(req, {
    accion: 'BLOQUEO_CREADO',
    entidad: 'bloqueos',
    entidad_id: bloqueo.id,
    datos_despues: {
      tipo: bloqueo.tipo,
      motivo: bloqueo.motivo,
      contratista_id: bloqueo.contratista_id,
      empresa_id: bloqueo.empresa_id,
      incidente_id: bloqueo.incidente_id,
    },
  });

  res.status(201).json({ datos: bloqueo });
}

export async function levantar(req: Request, res: Response) {
  const { id } = bloqueoIdSchema.parse(req.params);
  const datos = levantarBloqueoSchema.parse({ ...req.body, levantado_por: req.usuario!.id });
  const bloqueo = await bloqueosService.levantar(id, datos);

  await registrarAuditoria(req, {
    accion: 'BLOQUEO_LEVANTADO',
    entidad: 'bloqueos',
    entidad_id: id,
    datos_antes: { tipo: bloqueo.tipo, motivo: bloqueo.motivo },
    datos_despues: { motivo_levantamiento: datos.motivo },
  });

  res.json({ datos: bloqueo });
}