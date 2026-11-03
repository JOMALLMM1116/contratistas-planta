import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

// Se envia el QR escaneado (token) o el codigo corto escrito a mano, uno de los dos
export const validarSchema = z
  .object({
    token: z.string().trim().min(20).max(2000).optional(),
    codigo: z.string().trim().toUpperCase().length(8).optional(),
    zona_id: z.number().int().positive(),
  })
  .refine((d) => Boolean(d.token) !== Boolean(d.codigo), {
    message: 'Envie el token del QR o el codigo corto (solo uno)',
    path: ['token'],
  });

export const salidaSchema = z.object({
  contratista_id: z.uuid(),
  observaciones: z.string().trim().max(500).optional(),
});

export const dentroSchema = z.object({
  zona_id: z.coerce.number().int().positive().optional(),
});

export const movimientosSchema = esquemaPaginacion.extend({
  contratista_id: z.uuid().optional(),
  empresa_id: z.uuid().optional(),
  // Fechas "YYYY-MM-DD" en hora de Guatemala
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
});

export const credencialParamsSchema = z.object({
  id: z.uuid(),
});

export type Validar = z.infer<typeof validarSchema>;
export type Salida = z.infer<typeof salidaSchema>;
export type Movimientos = z.infer<typeof movimientosSchema>;
