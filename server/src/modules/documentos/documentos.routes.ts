import { Router } from 'express';
import * as documentosController from './documentos.controller.js';

export const documentosRouter = Router();

documentosRouter.get('/', documentosController.listar);
documentosRouter.get('/:id', documentosController.obtener);
documentosRouter.post('/', documentosController.crear);
documentosRouter.patch('/:id', documentosController.actualizar);
documentosRouter.post('/:id/revision', documentosController.revisar);
documentosRouter.delete('/:id', documentosController.eliminar);