import { Router } from 'express';
import * as registrosController from './contratista-capacitaciones.controller.js';

export const contratistaCapacitacionesRouter = Router();

contratistaCapacitacionesRouter.get('/', registrosController.listar);
contratistaCapacitacionesRouter.get('/:id', registrosController.obtener);
contratistaCapacitacionesRouter.post('/', registrosController.crear);
contratistaCapacitacionesRouter.patch('/:id', registrosController.actualizar);
contratistaCapacitacionesRouter.post('/:id/revision', registrosController.revisar);
contratistaCapacitacionesRouter.delete('/:id', registrosController.eliminar);