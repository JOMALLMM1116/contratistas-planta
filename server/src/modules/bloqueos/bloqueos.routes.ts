import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as bloqueosController from './bloqueos.controller.js';

export const bloqueosRouter = Router();

const gestionar = requierePermiso('bloqueos.gestionar');

bloqueosRouter.get('/', gestionar, bloqueosController.listar);
bloqueosRouter.get('/:id', gestionar, bloqueosController.obtener);
bloqueosRouter.post('/', gestionar, bloqueosController.crear);
bloqueosRouter.post('/:id/levantar', gestionar, bloqueosController.levantar);