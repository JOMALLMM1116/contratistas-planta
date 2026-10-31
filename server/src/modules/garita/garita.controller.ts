import type { Request, Response } from 'express';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as garitaService from './garita.service.js';
import { generarPase } from './garita.pase.js';
import { credencialParamsSchema, dentroSchema, movimientosSchema, salidaSchema, validarSchema } from './garita.schemas.js';

// Siempre 200: el resultado (permitido o no) va en el cuerpo para la pantalla de garita
export async function validar(req: Request, res: Response) {
  const datos = validarSchema.parse(req.body);
  res.json({ datos: await garitaService.validar(datos, req) });
}

// 201 si se registro el ingreso; 200 si se nego (el motivo va en el cuerpo)
export async function entrada(req: Request, res: Response) {
  const datos = validarSchema.parse(req.body);
  const resultado = await garitaService.entrada(datos, req);
  res.status(resultado.registrado ? 201 : 200).json({ datos: resultado });
}

export async function salida(req: Request, res: Response) {
  const datos = salidaSchema.parse(req.body);
  res.status(201).json({ datos: await garitaService.salida(datos, req) });
}

export async function dentro(req: Request, res: Response) {
  const { zona_id } = dentroSchema.parse(req.query);
  const personas = await garitaService.dentro(zona_id);
  res.json({ datos: personas, meta: { total: personas.length } });
}

export async function movimientos(req: Request, res: Response) {
  const filtros = movimientosSchema.parse(req.query);
  const { datos, total } = await garitaService.movimientos(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

// Devuelve el PDF para verlo o imprimirlo en el navegador
export async function pase(req: Request, res: Response) {
  const { id } = credencialParamsSchema.parse(req.params);
  const { pdf, nombreArchivo } = await generarPase(id, req);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
  res.send(pdf);
}
