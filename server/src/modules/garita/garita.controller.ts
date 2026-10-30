import type { Request, Response } from 'express';
import * as garitaService from './garita.service.js';
import { validarSchema } from './garita.schemas.js';

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
