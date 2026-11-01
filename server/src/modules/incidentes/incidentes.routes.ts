import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as incidentesController from './incidentes.controller.js';

export const incidentesRouter = Router();

const reportar = requierePermiso('incidentes.reportar');
const gestionar = requierePermiso('incidentes.gestionar');

incidentesRouter.get('/', gestionar, incidentesController.listar);
incidentesRouter.get('/:id', gestionar, incidentesController.obtener);
incidentesRouter.post('/', reportar, incidentesController.crear);
incidentesRouter.patch('/:id', gestionar, incidentesController.actualizar);
incidentesRouter.delete('/:id', gestionar, incidentesController.eliminar);

// Cambios de estado: abierto -> en_investigacion -> cerrado
incidentesRouter.post('/:id/investigar', gestionar, incidentesController.investigar);
incidentesRouter.post('/:id/cerrar', gestionar, incidentesController.cerrar);

// Evidencias: archivos ya subidos
incidentesRouter.post('/:id/evidencias', gestionar, incidentesController.agregarEvidencia);
incidentesRouter.delete('/:id/evidencias/:archivoId', gestionar, incidentesController.quitarEvidencia);