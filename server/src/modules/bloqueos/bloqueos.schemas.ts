import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const tipo = z.enum(['documento_vencido', 'incidente', 'manual']);

export const crearBloqueoSchema = z
  .object({
    tipo,
    motivo: z.string().trim().min(3).max(500),
    contratista_id: z.uuid().nullable().optional(),
    empresa_id: z.uuid().nullable().optional(),
    incidente_id: z.uuid().nullable().optional(),
    // Lo fija el controlador con el usuario de la sesion
    creado_por: z.uuid(),
  })
  // Regla de la base (ck_bloqueo_objetivo): exactamente un objetivo
  .refine((d) => [d.contratista_id, d.empresa_id].filter((v) => v != null).length === 1, {
    message: 'Indique exactamente uno: contratista_id o empresa_id',
    path: ['contratista_id'],
  });

export const levantarBloqueoSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
  // Lo fija el controlador con el usuario de la sesion
  levantado_por: z.uuid(),
});

export const bloqueoIdSchema = z.object({
  id: z.uuid(),
});

export const listarBloqueosSchema = esquemaPaginacion.extend({
  // true = solo activos; false = solo levantados (historial); sin valor = todos
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  tipo: tipo.optional(),
  empresa_id: z.uuid().optional(),
  contratista_id: z.uuid().optional(),
  ordenar_por: z.enum(['creado_en', 'levantado_en']).default('creado_en'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type CrearBloqueo = z.infer<typeof crearBloqueoSchema>;
export type LevantarBloqueo = z.infer<typeof levantarBloqueoSchema>;
export type ListarBloqueos = z.infer<typeof listarBloqueosSchema>;