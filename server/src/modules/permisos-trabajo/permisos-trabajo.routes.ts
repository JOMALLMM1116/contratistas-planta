import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as permisosController from './permisos-trabajo.controller.js';

export const permisosTrabajoRouter = Router();

const ver = requierePermiso('solicitudes.ver', 'permisos_trabajo.emitir');

permisosTrabajoRouter.get('/', ver, permisosController.listar);
permisosTrabajoRouter.get('/:id', ver, permisosController.obtener);
permisosTrabajoRouter.post('/', requierePermiso('permisos_trabajo.emitir'), permisosController.crear);

// Ciclo del permiso
permisosTrabajoRouter.post('/:id/iniciar', requierePermiso('actividad.confirmar'), permisosController.iniciar);
permisosTrabajoRouter.post('/:id/cerrar', requierePermiso('actividad.confirmar'), permisosController.cerrar);
permisosTrabajoRouter.post('/:id/revocar', requierePermiso('permisos_trabajo.revocar'), permisosController.revocar);

// Checklist de ejecucion
permisosTrabajoRouter.get('/:id/checklist', ver, permisosController.obtenerChecklist);
permisosTrabajoRouter.post('/:id/checklist', requierePermiso('checklist.completar'), permisosController.registrarChecklist);

// Evidencias
permisosTrabajoRouter.get('/:id/evidencias', ver, permisosController.listarEvidencias);
permisosTrabajoRouter.post('/:id/evidencias', requierePermiso('evidencias.registrar'), permisosController.agregarEvidencia);
permisosTrabajoRouter.delete('/:id/evidencias/:evidenciaId', requierePermiso('evidencias.registrar'), permisosController.eliminarEvidencia);
