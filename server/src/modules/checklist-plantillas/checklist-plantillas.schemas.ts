import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const idPositivo = z.number().int().positive();

// ---- Plantillas ----
const plantillaBase = z.object({
  tipo_trabajo_id: idPositivo,
  nombre: z.string().trim().min(2).max(150),
  activa: z.boolean(),
});

const itemNuevo = z.object({
  descripcion: z.string().trim().min(3).max(500),
  obligatorio: z.boolean().default(true),
});

export const crearPlantillaSchema = plantillaBase.extend({
  activa: plantillaBase.shape.activa.default(true),
  // El orden de cada item es su posicion en el arreglo (1, 2, 3...)
  items: z.array(itemNuevo).max(100).default([]),
});

export const actualizarPlantillaSchema = plantillaBase.partial();

export const plantillaIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listarPlantillasSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  tipo_trabajo_id: z.coerce.number().int().positive().optional(),
  activa: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ordenar_por: z.enum(['nombre', 'tipo_trabajo_id']).default('nombre'),
  orden: z.enum(['asc', 'desc']).default('asc'),
});

// ---- Items ----
const itemBase = z.object({
  descripcion: z.string().trim().min(3).max(500),
  obligatorio: z.boolean(),
  orden: z.number().int().min(1).max(32767),
});

export const crearItemSchema = itemBase.extend({
  obligatorio: itemBase.shape.obligatorio.default(true),
  orden: itemBase.shape.orden.optional(),
});

export const actualizarItemSchema = itemBase.partial();

export const itemParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});

export type CrearPlantilla = z.infer<typeof crearPlantillaSchema>;
export type ActualizarPlantilla = z.infer<typeof actualizarPlantillaSchema>;
export type ListarPlantillas = z.infer<typeof listarPlantillasSchema>;
export type CrearItem = z.infer<typeof crearItemSchema>;
export type ActualizarItem = z.infer<typeof actualizarItemSchema>;