import { Router } from 'express';
import * as archivosController from './archivos.controller.js';
import { subirArchivo } from './archivos.storage.js';

export const archivosRouter = Router();

archivosRouter.get('/', archivosController.listar);
archivosRouter.get('/:id', archivosController.obtener);
archivosRouter.get('/:id/descargar', archivosController.descargar);
archivosRouter.post('/', subirArchivo, archivosController.subir);
archivosRouter.delete('/:id', archivosController.eliminar);