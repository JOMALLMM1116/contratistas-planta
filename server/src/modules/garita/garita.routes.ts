import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as garitaController from './garita.controller.js';

export const garitaRouter = Router();

garitaRouter.post('/validar', requierePermiso('garita.validar'), garitaController.validar);
garitaRouter.post('/entrada', requierePermiso('garita.registrar_acceso'), garitaController.entrada);
