import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const estadoSolicitud = z.enum([
  'borrador', 'pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada', 'vencida', 'revocada',
]);

// Fechas "YYYY-MM-DD" y horas "HH:MM"; la base guarda DATE y TIME
const fecha = z.iso.date().transform((v) => new Date(v));
const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use el formato HH:MM')
  .transform((v) => new Date(`1970-01-01T${v}:00.000Z`));

const uuids = z.array(z.uuid()).max(200).transform((lista) => [...new Set(lista)]);
const zonaIds = z.array(z.number().int().positive()).max(50).transform((lista) => [...new Set(lista)]);

const solicitudBase = z.object({
  empresa_id: z.uuid(),
  tipo_trabajo_id: z.number().int().positive(),
  // Provisional: cuando exista auth, solicitada_por saldra del usuario autenticado
  responsable_interno_id: z.uuid(),
  solicitada_por: z.uuid(),
  descripcion_actividad: z.string().trim().min(5).max(2000),
  fecha_inicio: fecha,
  fecha_fin: fecha,
  hora_inicio: hora,
  hora_fin: hora,
  contratistas: uuids,
  zonas: zonaIds,
  equipos: uuids,
});

// Reglas de la base: fecha_fin >= fecha_inicio y hora_fin > hora_inicio
export const crearSolicitudSchema = solicitudBase
  .extend({ contratistas: uuids.default([]), zonas: zonaIds.default([]), equipos: uuids.default([]) })
  .refine((d) => d.fecha_fin >= d.fecha_inicio, {
    message: 'La fecha fin no puede ser anterior a la de inicio',
    path: ['fecha_fin'],
  })
  .refine((d) => d.hora_fin > d.hora_inicio, {
    message: 'La hora fin debe ser posterior a la de inicio',
    path: ['hora_fin'],
  });

// La empresa no cambia; si se envian listas, reemplazan a las anteriores
export const actualizarSolicitudSchema = solicitudBase.omit({ empresa_id: true, solicitada_por: true }).partial();

export const solicitudIdSchema = z.object({
  id: z.uuid(),
});

export const enviarSolicitudSchema = z.object({
  usuario_id: z.uuid().optional(),
});

export const cancelarSolicitudSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
  usuario_id: z.uuid().optional(),
});

export const evaluarSolicitudSchema = z.object({
  evaluador_id: z.uuid(),
  nivel_riesgo: z.enum(['bajo', 'medio', 'alto', 'critico']),
  peligros_identificados: z.string().trim().min(3).max(2000),
  medidas_control: z.string().trim().min(3).max(2000),
  epp_requerido: z.string().trim().max(1000).nullable().optional(),
  resultado: z.enum(['aprobada', 'condicionada', 'rechazada']),
});

export const autorizarSolicitudSchema = z
  .object({
    usuario_id: z.uuid(),
    decision: z.enum(['aprobada', 'rechazada']),
    comentario: z.string().trim().min(3).max(500).optional(),
  })
  .refine((d) => d.decision !== 'rechazada' || !!d.comentario, {
    message: 'Indique el motivo del rechazo en comentario',
    path: ['comentario'],
  });

export const listarSolicitudesSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  estado: estadoSolicitud.optional(),
  empresa_id: z.uuid().optional(),
  tipo_trabajo_id: z.coerce.number().int().positive().optional(),
  zona_id: z.coerce.number().int().positive().optional(),
  contratista_id: z.uuid().optional(),
  // Solicitudes cuyo periodo se cruza con el rango [desde, hasta]
  desde: fecha.optional(),
  hasta: fecha.optional(),
  ordenar_por: z.enum(['created_at', 'fecha_inicio', 'codigo']).default('created_at'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type CrearSolicitud = z.infer<typeof crearSolicitudSchema>;
export type ActualizarSolicitud = z.infer<typeof actualizarSolicitudSchema>;
export type EnviarSolicitud = z.infer<typeof enviarSolicitudSchema>;
export type CancelarSolicitud = z.infer<typeof cancelarSolicitudSchema>;
export type EvaluarSolicitud = z.infer<typeof evaluarSolicitudSchema>;
export type AutorizarSolicitud = z.infer<typeof autorizarSolicitudSchema>;
export type ListarSolicitudes = z.infer<typeof listarSolicitudesSchema>;