import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const aplicaA = z.enum(['contratista', 'empresa', 'equipo']);

const tipoDocumentoBase = z.object({
  codigo: z.string().trim().min(2).max(40).toUpperCase(),
  nombre: z.string().trim().min(2).max(120),
  aplica_a: aplicaA,
  requiere_vencimiento: z.boolean(),
  dias_alerta_vencimiento: z.number().int().min(0),
});

export const crearTipoDocumentoSchema = tipoDocumentoBase.extend({
  requiere_vencimiento: tipoDocumentoBase.shape.requiere_vencimiento.default(true),
  dias_alerta_vencimiento: tipoDocumentoBase.shape.dias_alerta_vencimiento.default(30),
});

export const actualizarTipoDocumentoSchema = tipoDocumentoBase.partial();

export const tipoDocumentoIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listarTiposDocumentoSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  aplica_a: aplicaA.optional(),
  requiere_vencimiento: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ordenar_por: z.enum(['codigo', 'nombre', 'aplica_a']).default('codigo'),
  orden: z.enum(['asc', 'desc']).default('asc'),
});

export type CrearTipoDocumento = z.infer<typeof crearTipoDocumentoSchema>;
export type ActualizarTipoDocumento = z.infer<typeof actualizarTipoDocumentoSchema>;
export type ListarTiposDocumento = z.infer<typeof listarTiposDocumentoSchema>;