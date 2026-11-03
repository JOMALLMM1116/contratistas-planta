import type { Request, Response } from 'express';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as incidentesService from './incidentes.service.js';
import {
  actualizarIncidenteSchema,
  agregarEvidenciaSchema,
  cerrarIncidenteSchema,
  crearIncidenteSchema,
  evidenciaParamsSchema,
  incidenteIdSchema,
  investigarIncidenteSchema,
  listarIncidentesSchema,
} from './incidentes.schemas.js';

// reportado_por y cerrado_por salen de la sesion (req.usuario), nunca del cuerpo

export async function listar(req: Request, res: Response) {
  const filtros = listarIncidentesSchema.parse(req.query);
  const { datos, total } = await incidentesService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = incidenteIdSchema.parse(req.params);
  res.json({ datos: await incidentesService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearIncidenteSchema.parse({ ...req.body, reportado_por: req.usuario!.id });
  const incidente = await incidentesService.crear(datos);

  await registrarAuditoria(req, {
    accion: 'INCIDENTE_CREADO',
    entidad: 'incidente',
    entidad_id: incidente.id,
    datos_despues: {
      codigo: incidente.codigo,
      severidad: incidente.severidad,
      empresa_id: incidente.empresa_id,
      contratista_id: incidente.contratista_id,
      solicitud_id: incidente.solicitud_id,
    },
  });

  res.status(201).json({ datos: incidente });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = incidenteIdSchema.parse(req.params);
  const datos = actualizarIncidenteSchema.parse(req.body);
  res.json({ datos: await incidentesService.actualizar(id, datos) });
}

export async function investigar(req: Request, res: Response) {
  const { id } = incidenteIdSchema.parse(req.params);
  const datos = investigarIncidenteSchema.parse({ ...req.body, usuario_id: req.usuario!.id });
  res.json({ datos: await incidentesService.investigar(id, datos) });
}

export async function cerrar(req: Request, res: Response) {
  const { id } = incidenteIdSchema.parse(req.params);
  const datos = cerrarIncidenteSchema.parse({ ...req.body, cerrado_por: req.usuario!.id });
  const incidente = await incidentesService.cerrar(id, datos);

  await registrarAuditoria(req, {
    accion: 'INCIDENTE_CERRADO',
    entidad: 'incidente',
    entidad_id: id,
    datos_despues: { codigo: incidente.codigo, estado: incidente.estado, motivo: datos.motivo ?? null },
  });

  res.json({ datos: incidente });
}

export async function eliminar(req: Request, res: Response) {
  const { id } = incidenteIdSchema.parse(req.params);
  const incidente = await incidentesService.eliminar(id);

  await registrarAuditoria(req, {
    accion: 'INCIDENTE_ELIMINADO',
    entidad: 'incidente',
    entidad_id: id,
    datos_antes: { codigo: incidente.codigo, estado: incidente.estado, severidad: incidente.severidad },
  });

  res.json({ datos: incidente });
}

export async function agregarEvidencia(req: Request, res: Response) {
  const { id } = incidenteIdSchema.parse(req.params);
  const { archivo_id } = agregarEvidenciaSchema.parse(req.body);
  res.status(201).json({ datos: await incidentesService.agregarEvidencia(id, archivo_id) });
}

export async function quitarEvidencia(req: Request, res: Response) {
  const { id, archivoId } = evidenciaParamsSchema.parse(req.params);
  res.json({ datos: await incidentesService.quitarEvidencia(id, archivoId) });
}