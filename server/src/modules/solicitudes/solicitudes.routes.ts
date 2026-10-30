import { Router } from 'express';
import * as solicitudesController from './solicitudes.controller.js';

export const solicitudesRouter = Router();

solicitudesRouter.get('/', solicitudesController.listar);
solicitudesRouter.get('/:id', solicitudesController.obtener);
solicitudesRouter.get('/:id/requisitos', solicitudesController.requisitos);
solicitudesRouter.post('/', solicitudesController.crear);
solicitudesRouter.patch('/:id', solicitudesController.actualizar);
solicitudesRouter.delete('/:id', solicitudesController.eliminar);

// Flujo de la solicitud
solicitudesRouter.post('/:id/enviar', solicitudesController.enviar);
solicitudesRouter.post('/:id/evaluacion-riesgo', solicitudesController.evaluar);
solicitudesRouter.post('/:id/autorizaciones', solicitudesController.autorizar);
solicitudesRouter.post('/:id/cancelar', solicitudesController.cancelar);