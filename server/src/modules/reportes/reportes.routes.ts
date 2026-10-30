import { Router } from 'express';
import * as reportesController from './reportes.controller.js';

export const reportesRouter = Router();

// El dashboard va primero: /:tipo capturaria la palabra "dashboard"
reportesRouter.get('/dashboard', reportesController.dashboard);
reportesRouter.get('/:tipo', reportesController.reporte);