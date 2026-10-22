import { Router } from 'express';
import * as notificacionesController from './notificaciones.controller.js';

export const notificacionesRouter = Router();

notificacionesRouter.get('/', notificacionesController.listar);
notificacionesRouter.get('/conteo', notificacionesController.conteo);
notificacionesRouter.post('/marcar-leidas', notificacionesController.marcarTodasLeidas);
notificacionesRouter.patch('/:id/leida', notificacionesController.marcarLeida);

// Revision de vencimientos (la misma que ejecuta el cron cada dia)
notificacionesRouter.post('/revision', notificacionesController.revision);