import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as auditoriaController from './auditoria.controller.js';

export const auditoriaRouter = Router();

const ver = requierePermiso('auditoria.ver');

// Primero /historial: /:algo no existe, pero asi se evita confundir rutas
auditoriaRouter.get('/historial', ver, auditoriaController.historial);
auditoriaRouter.get('/', ver, auditoriaController.listar);