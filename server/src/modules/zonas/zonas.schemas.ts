import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

// Campos base sin valores por defecto (para que PATCH no los sobrescriba)
const zonaBase = z.object({
  codigo: z.string().trim().min(2).max(30).toUpperCase(),
  nombre: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(500).nullable().optional(),
  nivel_riesgo: z.number().int().min(1).max(4),
  activa: z.boolean(),
});

export const crearZonaSchema = zonaBase.extend({
  nivel_riesgo: zonaBase.shape.nivel_riesgo.default(1),
  activa: zonaBase.shape.activa.default(true),
});

export const actualizarZonaSchema = zonaBase.partial();

export const zonaIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listarZonasSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  activa: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  nivel_riesgo: z.coerce.number().int().min(1).max(4).optional(),
  ordenar_por: z.enum(['codigo', 'nombre', 'nivel_riesgo']).default('codigo'),
  orden: z.enum(['asc', 'desc']).default('asc'),
});

export type CrearZona = z.infer<typeof crearZonaSchema>;
export type ActualizarZona = z.infer<typeof actualizarZonaSchema>;
export type ListarZonas = z.infer<typeof listarZonasSchema>;
