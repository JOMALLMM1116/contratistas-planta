import { Router } from 'express';
import * as contratistasController from './contratistas.controller.js';

export const contratistasRouter = Router();

contratistasRouter.get('/', contratistasController.listar);
contratistasRouter.get('/:id', contratistasController.obtener);
contratistasRouter.post('/', contratistasController.crear);
contratistasRouter.patch('/:id', contratistasController.actualizar);
contratistasRouter.delete('/:id', contratistasController.desactivar);