import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as usuariosController from './usuarios.controller.js';

export const usuariosRouter = Router();

const gestionar = requierePermiso('usuarios.gestionar');

usuariosRouter.get('/', gestionar, usuariosController.listar);
usuariosRouter.get('/:id', gestionar, usuariosController.obtener);
usuariosRouter.post('/', gestionar, usuariosController.crear);
usuariosRouter.patch('/:id', gestionar, usuariosController.actualizar);
usuariosRouter.post('/:id/restablecer-password', gestionar, usuariosController.restablecerPassword);