import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const capacitacionBase = z.object({
  codigo: z.string().trim().min(2).max(40).toUpperCase(),
  nombre: z.string().trim().min(2).max(150),
  descripcion: z.string().trim().max(500).nullable().optional(),
  // null = la capacitacion no vence
  vigencia_meses: z.number().int().positive().nullable().optional(),
});

export const crearCapacitacionSchema = capacitacionBase;

export const actualizarCapacitacionSchema = capacitacionBase.partial();

export const capacitacionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listarCapacitacionesSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  ordenar_por: z.enum(['codigo', 'nombre', 'vigencia_meses']).default('codigo'),
  orden: z.enum(['asc', 'desc']).default('asc'),
});

export type CrearCapacitacion = z.infer<typeof crearCapacitacionSchema>;
export type ActualizarCapacitacion = z.infer<typeof actualizarCapacitacionSchema>;
export type ListarCapacitaciones = z.infer<typeof listarCapacitacionesSchema>;