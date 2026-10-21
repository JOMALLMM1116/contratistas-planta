import { Router } from 'express';
import * as tiposTrabajoController from './tipos-trabajo.controller.js';

export const tiposTrabajoRouter = Router();

tiposTrabajoRouter.get('/', tiposTrabajoController.listar);
tiposTrabajoRouter.get('/:id', tiposTrabajoController.obtener);
tiposTrabajoRouter.post('/', tiposTrabajoController.crear);
tiposTrabajoRouter.patch('/:id', tiposTrabajoController.actualizar);
tiposTrabajoRouter.delete('/:id', tiposTrabajoController.desactivar);