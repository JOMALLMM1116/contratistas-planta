import { Router } from 'express';
import * as permisosController from './permisos-trabajo.controller.js';

export const permisosTrabajoRouter = Router();

permisosTrabajoRouter.get('/', permisosController.listar);
permisosTrabajoRouter.get('/:id', permisosController.obtener);
permisosTrabajoRouter.post('/', permisosController.crear);

// Ciclo del permiso
permisosTrabajoRouter.post('/:id/iniciar', permisosController.iniciar);
permisosTrabajoRouter.post('/:id/cerrar', permisosController.cerrar);
permisosTrabajoRouter.post('/:id/revocar', permisosController.revocar);

// Checklist de ejecucion
permisosTrabajoRouter.get('/:id/checklist', permisosController.obtenerChecklist);
permisosTrabajoRouter.post('/:id/checklist', permisosController.registrarChecklist);

// Evidencias
permisosTrabajoRouter.get('/:id/evidencias', permisosController.listarEvidencias);
permisosTrabajoRouter.post('/:id/evidencias', permisosController.agregarEvidencia);
permisosTrabajoRouter.delete('/:id/evidencias/:evidenciaId', permisosController.eliminarEvidencia);