import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as registrosController from './contratista-capacitaciones.controller.js';

export const contratistaCapacitacionesRouter = Router();

contratistaCapacitacionesRouter.get('/', registrosController.listar);
contratistaCapacitacionesRouter.get('/:id', registrosController.obtener);
contratistaCapacitacionesRouter.post('/', requierePermiso('documentos.subir', 'documentos.revisar'), registrosController.crear);
contratistaCapacitacionesRouter.patch('/:id', requierePermiso('documentos.subir', 'documentos.revisar'), registrosController.actualizar);
contratistaCapacitacionesRouter.post('/:id/revision', requierePermiso('documentos.revisar'), registrosController.revisar);
contratistaCapacitacionesRouter.delete('/:id', requierePermiso('documentos.revisar'), registrosController.eliminar);
