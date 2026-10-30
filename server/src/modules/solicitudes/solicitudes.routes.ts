import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as solicitudesController from './solicitudes.controller.js';

export const solicitudesRouter = Router();

const ver = requierePermiso('solicitudes.ver');
const gestionar = requierePermiso('solicitudes.crear');

solicitudesRouter.get('/', ver, solicitudesController.listar);
solicitudesRouter.get('/:id', ver, solicitudesController.obtener);
solicitudesRouter.get('/:id/requisitos', ver, solicitudesController.requisitos);
solicitudesRouter.post('/', gestionar, solicitudesController.crear);
solicitudesRouter.patch('/:id', gestionar, solicitudesController.actualizar);
solicitudesRouter.delete('/:id', gestionar, solicitudesController.eliminar);

// Flujo de la solicitud
solicitudesRouter.post('/:id/enviar', gestionar, solicitudesController.enviar);
solicitudesRouter.post('/:id/evaluacion-riesgo', requierePermiso('riesgos.evaluar'), solicitudesController.evaluar);
solicitudesRouter.post('/:id/autorizaciones', requierePermiso('solicitudes.autorizar'), solicitudesController.autorizar);
solicitudesRouter.post('/:id/cancelar', gestionar, solicitudesController.cancelar);
