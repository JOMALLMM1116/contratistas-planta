import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/auth.js';
import * as archivosController from './archivos.controller.js';
import { subirArchivo } from './archivos.storage.js';

export const archivosRouter = Router();

archivosRouter.get('/', archivosController.listar);
archivosRouter.get('/:id', archivosController.obtener);
archivosRouter.get('/:id/descargar', archivosController.descargar);
// El permiso se verifica ANTES de multer: un usuario sin permiso no llega a escribir en disco
archivosRouter.post('/', requierePermiso('documentos.subir', 'evidencias.registrar'), subirArchivo, archivosController.subir);
archivosRouter.delete('/:id', requierePermiso('documentos.revisar'), archivosController.eliminar);
