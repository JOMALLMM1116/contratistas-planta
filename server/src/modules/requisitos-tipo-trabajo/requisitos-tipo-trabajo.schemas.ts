import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const idPositivo = z.number().int().positive();

// Regla de la base (ck_requisito_uno): exactamente uno entre documento y capacitacion
export const crearRequisitoSchema = z
  .object({
    tipo_trabajo_id: idPositivo,
    tipo_documento_id: idPositivo.nullable().optional(),
    capacitacion_id: idPositivo.nullable().optional(),
    obligatorio: z.boolean().default(true),
  })
  .refine((d) => (d.tipo_documento_id != null) !== (d.capacitacion_id != null), {
    message: 'Debe indicar tipo_documento_id o capacitacion_id, pero no ambos',
    path: ['tipo_documento_id'],
  });

// Solo se puede cambiar si es obligatorio; para otro documento o capacitacion se borra y se crea
export const actualizarRequisitoSchema = z.object({
  obligatorio: z.boolean(),
});

export const requisitoIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listarRequisitosSchema = esquemaPaginacion.extend({
  tipo_trabajo_id: z.coerce.number().int().positive().optional(),
  tipo: z.enum(['documento', 'capacitacion']).optional(),
  obligatorio: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export type CrearRequisito = z.infer<typeof crearRequisitoSchema>;
export type ActualizarRequisito = z.infer<typeof actualizarRequisitoSchema>;
export type ListarRequisitos = z.infer<typeof listarRequisitosSchema>;