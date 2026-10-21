import { Router } from 'express';
import * as zonasController from './zonas.controller.js';

export const zonasRouter = Router();

// Cuando exista el modulo de auth se agregara:
//   zonasRouter.use(requiereAuth);
//   y requierePermiso('...') en las rutas de escritura

zonasRouter.get('/', zonasController.listar);
zonasRouter.get('/:id', zonasController.obtener);
zonasRouter.post('/', zonasController.crear);
zonasRouter.patch('/:id', zonasController.actualizar);
zonasRouter.delete('/:id', zonasController.desactivar);
