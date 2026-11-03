import { Router } from 'express';
import * as requisitosController from './requisitos-tipo-trabajo.controller.js';

export const requisitosRouter = Router();

requisitosRouter.get('/', requisitosController.listar);
requisitosRouter.get('/:id', requisitosController.obtener);
requisitosRouter.post('/', requisitosController.crear);
requisitosRouter.patch('/:id', requisitosController.actualizar);
requisitosRouter.delete('/:id', requisitosController.eliminar);