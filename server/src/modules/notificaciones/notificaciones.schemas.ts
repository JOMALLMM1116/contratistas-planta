import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

export const notificacionIdSchema = z.object({
  id: z.uuid(),
});

// Provisional: cuando exista el modulo de auth, el usuario saldra de la sesion
export const usuarioSchema = z.object({
  usuario_id: z.uuid(),
});

export const listarNotificacionesSchema = esquemaPaginacion.extend({
  usuario_id: z.uuid(),
  leida: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  tipo: z.string().trim().min(1).max(50).optional(),
});

export type ListarNotificaciones = z.infer<typeof listarNotificacionesSchema>;