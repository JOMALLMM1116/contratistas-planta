import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const tipoTrabajoBase = z.object({
  codigo: z.string().trim().min(2).max(40).toUpperCase(),
  nombre: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(500).nullable().optional(),
  requiere_permiso_trabajo: z.boolean(),
  requiere_evaluacion_riesgo: z.boolean(),
  activo: z.boolean(),
});

export const crearTipoTrabajoSchema = tipoTrabajoBase.extend({
  requiere_permiso_trabajo: tipoTrabajoBase.shape.requiere_permiso_trabajo.default(true),
  requiere_evaluacion_riesgo: tipoTrabajoBase.shape.requiere_evaluacion_riesgo.default(true),
  activo: tipoTrabajoBase.shape.activo.default(true),
});

export const actualizarTipoTrabajoSchema = tipoTrabajoBase.partial();

export const tipoTrabajoIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listarTiposTrabajoSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  requiere_permiso_trabajo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ordenar_por: z.enum(['codigo', 'nombre']).default('codigo'),
  orden: z.enum(['asc', 'desc']).default('asc'),
});

export type CrearTipoTrabajo = z.infer<typeof crearTipoTrabajoSchema>;
export type ActualizarTipoTrabajo = z.infer<typeof actualizarTipoTrabajoSchema>;
export type ListarTiposTrabajo = z.infer<typeof listarTiposTrabajoSchema>;