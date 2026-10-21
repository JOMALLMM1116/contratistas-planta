import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const estadoRevision = z.enum(['pendiente', 'aprobado', 'rechazado']);

// Fechas como "YYYY-MM-DD"; la base las guarda como DATE
const fecha = z.iso.date().transform((v) => new Date(v));

export const crearRegistroSchema = z
  .object({
    contratista_id: z.uuid(),
    capacitacion_id: z.number().int().positive(),
    fecha_realizacion: fecha,
    // Si se omite y la capacitacion tiene vigencia, se calcula
    fecha_vencimiento: fecha.nullable().optional(),
    archivo_id: z.uuid().nullable().optional(),
  })
  // Regla de la base: el vencimiento no puede ser anterior a la realizacion
  .refine((d) => !d.fecha_vencimiento || d.fecha_vencimiento >= d.fecha_realizacion, {
    message: 'La fecha de vencimiento no puede ser anterior a la de realizacion',
    path: ['fecha_vencimiento'],
  });

// Para cambiar contratista o capacitacion se crea otro registro
export const actualizarRegistroSchema = z.object({
  fecha_realizacion: fecha.optional(),
  fecha_vencimiento: fecha.nullable().optional(),
  archivo_id: z.uuid().nullable().optional(),
});

export const revisarRegistroSchema = z
  .object({
    decision: z.enum(['aprobado', 'rechazado']),
    // La tabla no tiene columna de observaciones: el motivo queda en historial_estados
    motivo: z.string().trim().min(3).max(500).optional(),
    // Provisional: cuando exista el modulo de auth saldra del usuario autenticado
    revisado_por: z.uuid(),
  })
  .refine((d) => d.decision !== 'rechazado' || !!d.motivo, {
    message: 'Indique el motivo del rechazo',
    path: ['motivo'],
  });

export const registroIdSchema = z.object({
  id: z.uuid(),
});

export const listarRegistrosSchema = esquemaPaginacion.extend({
  contratista_id: z.uuid().optional(),
  capacitacion_id: z.coerce.number().int().positive().optional(),
  estado_revision: estadoRevision.optional(),
  // Registros cuyo vencimiento cae en los proximos N dias
  por_vencer: z.coerce.number().int().min(0).max(365).optional(),
  vencidos: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ordenar_por: z.enum(['created_at', 'fecha_realizacion', 'fecha_vencimiento']).default('created_at'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type CrearRegistro = z.infer<typeof crearRegistroSchema>;
export type ActualizarRegistro = z.infer<typeof actualizarRegistroSchema>;
export type RevisarRegistro = z.infer<typeof revisarRegistroSchema>;
export type ListarRegistros = z.infer<typeof listarRegistrosSchema>;