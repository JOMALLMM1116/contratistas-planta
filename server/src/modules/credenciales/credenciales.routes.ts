import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as credencialesController from './credenciales.controller.js';

export const credencialesRouter = Router();

const personal = requierePermiso('credenciales.emitir', 'credenciales.revocar', 'garita.validar');

// /mias va antes de /:id para que no se confunda con un id
credencialesRouter.get('/mias', credencialesController.mias);
credencialesRouter.get('/', personal, credencialesController.listar);
credencialesRouter.get('/:id', personal, credencialesController.obtener);
// El servicio verifica que sea el propio contratista o personal autorizado
credencialesRouter.get('/:id/qr', credencialesController.qr);
credencialesRouter.post('/', requierePermiso('credenciales.emitir'), credencialesController.emitir);
credencialesRouter.post('/:id/revocar', requierePermiso('credenciales.revocar'), credencialesController.revocar);

