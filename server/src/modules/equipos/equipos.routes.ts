import { Router } from 'express';
import * as equiposController from './equipos.controller.js';

export const equiposRouter = Router();

equiposRouter.get('/', equiposController.listar);
equiposRouter.get('/:id', equiposController.obtener);
equiposRouter.post('/', equiposController.crear);
equiposRouter.patch('/:id', equiposController.actualizar);
equiposRouter.delete('/:id', equiposController.desactivar);