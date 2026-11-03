import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

export const emitirCredencialSchema = z.object({
  solicitud_id: z.uuid(),
  contratista_id: z.uuid(),
  // Sin valor: ingresos ilimitados durante la vigencia. Con valor: "ya utilizado" al agotarse
  usos_maximos: z.number().int().min(1).max(50).optional(),
});

export const revocarCredencialSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
});

export const credencialIdSchema = z.object({
  id: z.uuid(),
});

export const listarCredencialesSchema = esquemaPaginacion.extend({
  estado: z.enum(['activa', 'usada', 'revocada', 'vencida']).optional(),
  solicitud_id: z.uuid().optional(),
  contratista_id: z.uuid().optional(),
  ordenar_por: z.enum(['emitida_en', 'expira_en']).default('emitida_en'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type EmitirCredencial = z.infer<typeof emitirCredencialSchema>;
export type ListarCredenciales = z.infer<typeof listarCredencialesSchema>;
