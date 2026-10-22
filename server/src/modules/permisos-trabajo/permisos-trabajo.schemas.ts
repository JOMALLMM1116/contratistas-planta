import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const estadoPermiso = z.enum(['emitido', 'en_ejecucion', 'cerrado', 'revocado', 'vencido']);

// Fechas como "YYYY-MM-DD"; la base las guarda como DATE
const fecha = z.iso.date().transform((v) => new Date(v));

export const crearPermisoSchema = z.object({
  solicitud_id: z.uuid(),
  // Provisional: cuando exista el modulo de auth saldra del usuario autenticado
  aprobado_por: z.uuid(),
  condiciones_especiales: z.string().trim().max(2000).nullable().optional(),
});

export const iniciarPermisoSchema = z.object({
  usuario_id: z.uuid(),
});

export const cerrarPermisoSchema = z.object({
  usuario_id: z.uuid(),
  observaciones: z.string().trim().min(3).max(500).optional(),
});

export const revocarPermisoSchema = z.object({
  usuario_id: z.uuid(),
  motivo: z.string().trim().min(3).max(500),
});

export const registrarChecklistSchema = z.object({
  respuestas: z
    .array(
      z.object({
        contratista_id: z.uuid(),
        item_id: z.number().int().positive(),
        cumple: z.boolean(),
        observacion: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const crearEvidenciaSchema = z.object({
  archivo_id: z.uuid(),
  momento: z.enum(['inicio', 'durante', 'cierre']).default('durante'),
  descripcion: z.string().trim().max(500).nullable().optional(),
  registrado_por: z.uuid(),
});

export const permisoIdSchema = z.object({
  id: z.uuid(),
});

export const evidenciaParamsSchema = z.object({
  id: z.uuid(),
  evidenciaId: z.uuid(),
});

export const listarPermisosSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  estado: estadoPermiso.optional(),
  solicitud_id: z.uuid().optional(),
  empresa_id: z.uuid().optional(),
  // Permisos cuyo periodo se cruza con el rango [desde, hasta]
  desde: fecha.optional(),
  hasta: fecha.optional(),
  ordenar_por: z.enum(['emitido_en', 'fecha_inicio', 'codigo']).default('emitido_en'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type CrearPermiso = z.infer<typeof crearPermisoSchema>;
export type IniciarPermiso = z.infer<typeof iniciarPermisoSchema>;
export type CerrarPermiso = z.infer<typeof cerrarPermisoSchema>;
export type RevocarPermiso = z.infer<typeof revocarPermisoSchema>;
export type RegistrarChecklist = z.infer<typeof registrarChecklistSchema>;
export type CrearEvidencia = z.infer<typeof crearEvidenciaSchema>;
export type ListarPermisos = z.infer<typeof listarPermisosSchema>;