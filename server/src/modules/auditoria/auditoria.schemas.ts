import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

// Fechas "YYYY-MM-DD" interpretadas en hora de Guatemala (UTC-6, sin horario de verano)
const MS_DIA = 86_400_000;
const inicioDia = (v: string) => new Date(new Date(`${v}T00:00:00.000Z`).getTime() + 6 * 3_600_000);
const finDia = (v: string) => new Date(inicioDia(v).getTime() + MS_DIA - 1);

export const listarAuditoriaSchema = esquemaPaginacion
  .extend({
    desde: z.iso.date().optional(),
    hasta: z.iso.date().optional(),
    usuario_email: z.string().trim().min(1).max(255).optional(),
    accion: z.string().trim().min(1).max(60).optional(),
    entidad: z.string().trim().min(1).max(60).optional(),
    resultado: z.enum(['ok', 'denegado', 'error']).optional(),
  })
  .refine((d) => !d.desde || !d.hasta || d.hasta >= d.desde, {
    message: 'La fecha hasta no puede ser anterior a la fecha desde',
    path: ['hasta'],
  })
  .transform((d) => ({
    ...d,
    desde: d.desde ? inicioDia(d.desde) : undefined,
    hasta: d.hasta ? finDia(d.hasta) : undefined,
  }));

// historial_estados.entidad_id es uuid
export const historialSchema = z.object({
  entidad: z.string().trim().min(1).max(40),
  entidad_id: z.uuid(),
});

export type ListarAuditoria = z.infer<typeof listarAuditoriaSchema>;
export type FiltroHistorial = z.infer<typeof historialSchema>;