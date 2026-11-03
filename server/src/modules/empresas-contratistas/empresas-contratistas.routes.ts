import { Router } from 'express';
import * as empresasController from './empresas-contratistas.controller.js';

export const empresasRouter = Router();

empresasRouter.get('/', empresasController.listar);
empresasRouter.get('/:id', empresasController.obtener);
empresasRouter.post('/', empresasController.crear);
empresasRouter.patch('/:id', empresasController.actualizar);
empresasRouter.delete('/:id', empresasController.desactivar);