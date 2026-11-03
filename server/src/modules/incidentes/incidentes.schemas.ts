import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const severidad = z.enum(['leve', 'moderado', 'grave', 'critico']);
const estado = z.enum(['abierto', 'en_investigacion', 'cerrado']);

// Fechas "YYYY-MM-DD" interpretadas en hora de Guatemala (UTC-6, sin horario de verano)
const inicioDia = (v: string) => new Date(new Date(`${v}T00:00:00.000Z`).getTime() + 6 * 3_600_000);
const finDia = (v: string) => new Date(inicioDia(v).getTime() + 86_400_000 - 1);

const uuidsUnicos = z.array(z.uuid()).max(20).transform((lista) => [...new Set(lista)]);

export const crearIncidenteSchema = z
  .object({
    contratista_id: z.uuid().nullable().optional(),
    empresa_id: z.uuid().nullable().optional(),
    solicitud_id: z.uuid().nullable().optional(),
    zona_id: z.number().int().positive().nullable().optional(),
    severidad,
    descripcion: z.string().trim().min(5).max(2000),
    fecha_ocurrencia: z.coerce.date().optional(),
    // Archivos ya subidos que se vinculan como evidencia
    archivos: uuidsUnicos.default([]),
    // Lo fija el controlador con el usuario de la sesion
    reportado_por: z.uuid(),
  })
  // Regla de la base: al menos uno de los tres
  .refine((d) => !!(d.contratista_id || d.empresa_id || d.solicitud_id), {
    message: 'Indique contratista_id, empresa_id o solicitud_id',
    path: ['contratista_id'],
  });

export const actualizarIncidenteSchema = z
  .object({
    severidad: severidad.optional(),
    descripcion: z.string().trim().min(5).max(2000).optional(),
    zona_id: z.number().int().positive().nullable().optional(),
    fecha_ocurrencia: z.coerce.date().optional(),
    acciones_correctivas: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Indique al menos un campo a modificar' });

export const investigarIncidenteSchema = z.object({
  // Lo fija el controlador con el usuario de la sesion
  usuario_id: z.uuid(),
  motivo: z.string().trim().min(3).max(500).optional(),
});

export const cerrarIncidenteSchema = z.object({
  // Lo fija el controlador con el usuario de la sesion
  cerrado_por: z.uuid(),
  motivo: z.string().trim().min(3).max(500).optional(),
  acciones_correctivas: z.string().trim().min(3).max(2000).optional(),
});

export const agregarEvidenciaSchema = z.object({
  archivo_id: z.uuid(),
});

export const incidenteIdSchema = z.object({
  id: z.uuid(),
});

export const evidenciaParamsSchema = z.object({
  id: z.uuid(),
  archivoId: z.uuid(),
});

export const listarIncidentesSchema = esquemaPaginacion
  .extend({
    estado: estado.optional(),
    severidad: severidad.optional(),
    empresa_id: z.uuid().optional(),
    contratista_id: z.uuid().optional(),
    desde: z.iso.date().optional(),
    hasta: z.iso.date().optional(),
    ordenar_por: z.enum(['fecha_ocurrencia', 'created_at', 'codigo']).default('fecha_ocurrencia'),
    orden: z.enum(['asc', 'desc']).default('desc'),
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

export type CrearIncidente = z.infer<typeof crearIncidenteSchema>;
export type ActualizarIncidente = z.infer<typeof actualizarIncidenteSchema>;
export type InvestigarIncidente = z.infer<typeof investigarIncidenteSchema>;
export type CerrarIncidente = z.infer<typeof cerrarIncidenteSchema>;
export type ListarIncidentes = z.infer<typeof listarIncidentesSchema>;