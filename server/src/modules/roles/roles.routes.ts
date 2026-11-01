import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as rolesController from './roles.controller.js';

export const rolesRouter = Router();

rolesRouter.get('/', requierePermiso('usuarios.gestionar'), rolesController.listar);