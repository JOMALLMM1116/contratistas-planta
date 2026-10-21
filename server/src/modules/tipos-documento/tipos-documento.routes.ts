import { Router } from 'express';
import * as tiposDocumentoController from './tipos-documento.controller.js';

export const tiposDocumentoRouter = Router();

tiposDocumentoRouter.get('/', tiposDocumentoController.listar);
tiposDocumentoRouter.get('/:id', tiposDocumentoController.obtener);
tiposDocumentoRouter.post('/', tiposDocumentoController.crear);
tiposDocumentoRouter.patch('/:id', tiposDocumentoController.actualizar);
tiposDocumentoRouter.delete('/:id', tiposDocumentoController.eliminar);