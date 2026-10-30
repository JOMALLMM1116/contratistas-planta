import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as documentosController from './documentos.controller.js';

export const documentosRouter = Router();

documentosRouter.get('/', documentosController.listar);
documentosRouter.get('/:id', documentosController.obtener);
documentosRouter.post('/', requierePermiso('documentos.subir', 'documentos.revisar'), documentosController.crear);
documentosRouter.patch('/:id', requierePermiso('documentos.subir', 'documentos.revisar'), documentosController.actualizar);
documentosRouter.post('/:id/revision', requierePermiso('documentos.revisar'), documentosController.revisar);
documentosRouter.delete('/:id', requierePermiso('documentos.revisar'), documentosController.eliminar);
