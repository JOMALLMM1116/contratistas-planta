import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as notificacionesController from './notificaciones.controller.js';

export const notificacionesRouter = Router();

const propias = requierePermiso('notificaciones.ver');

notificacionesRouter.get('/', propias, notificacionesController.listar);
notificacionesRouter.get('/conteo', propias, notificacionesController.conteo);
notificacionesRouter.post('/marcar-leidas', propias, notificacionesController.marcarTodasLeidas);
notificacionesRouter.patch('/:id/leida', propias, notificacionesController.marcarLeida);

// Revision de vencimientos a mano (la misma que ejecuta el cron cada dia): solo admin
notificacionesRouter.post('/revision', requierePermiso('usuarios.gestionar'), notificacionesController.revision);
