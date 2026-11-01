import type { Request, Response } from 'express';
import * as rolesService from './roles.service.js';

export async function listar(_req: Request, res: Response) {
  res.json({ datos: await rolesService.listar() });
}