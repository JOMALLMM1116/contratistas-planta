import { Router } from 'express';
import * as plantillasController from './checklist-plantillas.controller.js';

export const checklistPlantillasRouter = Router();

checklistPlantillasRouter.get('/', plantillasController.listar);
checklistPlantillasRouter.get('/:id', plantillasController.obtener);
checklistPlantillasRouter.post('/', plantillasController.crear);
checklistPlantillasRouter.patch('/:id', plantillasController.actualizar);
checklistPlantillasRouter.delete('/:id', plantillasController.desactivar);

// Items de la plantilla
checklistPlantillasRouter.post('/:id/items', plantillasController.agregarItem);
checklistPlantillasRouter.patch('/:id/items/:itemId', plantillasController.actualizarItem);
checklistPlantillasRouter.delete('/:id/items/:itemId', plantillasController.eliminarItem);