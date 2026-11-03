import type { Request, Response } from 'express';
import { AppError } from '../../shared/errors/app-error.js';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import { alcanceDe } from '../../shared/seguridad/alcance.js';
import * as archivosService from './archivos.service.js';
import { archivoIdSchema, listarArchivosSchema } from './archivos.schemas.js';

// Un usuario externo solo ve, descarga o elimina archivos de su alcance (SEG-01)

export async function listar(req: Request, res: Response) {
  const filtros = listarArchivosSchema.parse(req.query);
  const { datos, total } = await archivosService.listar(filtros, alcanceDe(req.usuario), req.usuario?.id ?? null);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = archivoIdSchema.parse(req.params);
  res.json({ datos: await archivosService.obtener(id, alcanceDe(req.usuario), req.usuario?.id ?? null) });
}

export async function subir(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, 'ARCHIVO_REQUERIDO', 'Envie el archivo en el campo "archivo" (multipart/form-data)');
  }
  // Quien sube el archivo sale de la sesion
  res.status(201).json({ datos: await archivosService.registrar(req.file, req.usuario!.id) });
}

export async function descargar(req: Request, res: Response) {
  const { id } = archivoIdSchema.parse(req.params);
  const { ruta, nombre } = await archivosService.datosDescarga(id, alcanceDe(req.usuario), req.usuario?.id ?? null);
  res.download(ruta, nombre);
}

export async function eliminar(req: Request, res: Response) {
  const { id } = archivoIdSchema.parse(req.params);
  res.json({ datos: await archivosService.eliminar(id, alcanceDe(req.usuario), req.usuario?.id ?? null) });
}
