import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const estadoRevision = z.enum(['pendiente', 'aprobado', 'rechazado']);

// Fechas como "YYYY-MM-DD"; la base las guarda como DATE
const fecha = z.iso.date().transform((v) => new Date(v));

export const crearDocumentoSchema = z
  .object({
    tipo_documento_id: z.number().int().positive(),
    contratista_id: z.uuid().nullable().optional(),
    empresa_id: z.uuid().nullable().optional(),
    equipo_id: z.uuid().nullable().optional(),
    archivo_id: z.uuid(),
    numero: z.string().trim().max(60).nullable().optional(),
    fecha_emision: fecha.nullable().optional(),
    fecha_vencimiento: fecha.nullable().optional(),
    observaciones: z.string().trim().max(500).nullable().optional(),
  })
  // Regla de la base (ck_documento_un_dueno): exactamente un dueno
  .refine((d) => [d.contratista_id, d.empresa_id, d.equipo_id].filter((v) => v != null).length === 1, {
    message: 'Indique exactamente uno: contratista_id, empresa_id o equipo_id',
    path: ['contratista_id'],
  })
  // Regla de la base (ck_documento_fechas)
  .refine((d) => !d.fecha_emision || !d.fecha_vencimiento || d.fecha_vencimiento >= d.fecha_emision, {
    message: 'La fecha de vencimiento no puede ser anterior a la de emision',
    path: ['fecha_vencimiento'],
  });

// Solo estos campos se editan; para cambiar dueno, tipo o archivo se crea otro documento
export const actualizarDocumentoSchema = z.object({
  numero: z.string().trim().max(60).nullable().optional(),
  fecha_emision: fecha.nullable().optional(),
  fecha_vencimiento: fecha.nullable().optional(),
  observaciones: z.string().trim().max(500).nullable().optional(),
});

export const revisarDocumentoSchema = z
  .object({
    decision: z.enum(['aprobado', 'rechazado']),
    observaciones: z.string().trim().min(3).max(500).optional(),
    // Provisional: cuando exista el modulo de auth saldra del usuario autenticado
    revisado_por: z.uuid(),
  })
  .refine((d) => d.decision !== 'rechazado' || !!d.observaciones, {
    message: 'Indique el motivo del rechazo en observaciones',
    path: ['observaciones'],
  });

export const documentoIdSchema = z.object({
  id: z.uuid(),
});

export const listarDocumentosSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  contratista_id: z.uuid().optional(),
  empresa_id: z.uuid().optional(),
  equipo_id: z.uuid().optional(),
  tipo_documento_id: z.coerce.number().int().positive().optional(),
  estado_revision: estadoRevision.optional(),
  // Documentos cuyo vencimiento cae en los proximos N dias
  por_vencer: z.coerce.number().int().min(0).max(365).optional(),
  vencidos: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ordenar_por: z.enum(['created_at', 'fecha_vencimiento', 'fecha_emision']).default('created_at'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type CrearDocumento = z.infer<typeof crearDocumentoSchema>;
export type ActualizarDocumento = z.infer<typeof actualizarDocumentoSchema>;
export type RevisarDocumento = z.infer<typeof revisarDocumentoSchema>;
export type ListarDocumentos = z.infer<typeof listarDocumentosSchema>;