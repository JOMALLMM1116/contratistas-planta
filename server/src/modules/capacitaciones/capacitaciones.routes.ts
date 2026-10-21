import { Router } from 'express';
import * as capacitacionesController from './capacitaciones.controller.js';

export const capacitacionesRouter = Router();

capacitacionesRouter.get('/', capacitacionesController.listar);
capacitacionesRouter.get('/:id', capacitacionesController.obtener);
capacitacionesRouter.post('/', capacitacionesController.crear);
capacitacionesRouter.patch('/:id', capacitacionesController.actualizar);
capacitacionesRouter.delete('/:id', capacitacionesController.eliminar);