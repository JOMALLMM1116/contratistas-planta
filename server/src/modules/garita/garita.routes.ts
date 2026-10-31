import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as garitaController from './garita.controller.js';

export const garitaRouter = Router();

// Control de acceso
garitaRouter.post('/validar', requierePermiso('garita.validar'), garitaController.validar);
garitaRouter.post('/entrada', requierePermiso('garita.registrar_acceso'), garitaController.entrada);
garitaRouter.post('/salida', requierePermiso('garita.registrar_acceso'), garitaController.salida);

// Consultas
garitaRouter.get('/dentro', requierePermiso('accesos.ver_personas_dentro'), garitaController.dentro);
garitaRouter.get('/movimientos', requierePermiso('accesos.ver_personas_dentro', 'reportes.ver'), garitaController.movimientos);

// Pase temporal en PDF
garitaRouter.get('/pase/:id', requierePermiso('garita.imprimir_pase'), garitaController.pase);
