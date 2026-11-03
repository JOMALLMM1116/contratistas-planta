import { z } from 'zod';

// Fechas "YYYY-MM-DD"; la base las guarda como DATE
const fecha = z.iso.date().transform((v) => new Date(v));

export const TIPOS_REPORTE = ['solicitudes', 'permisos', 'vencimientos', 'contratistas'] as const;

export const tipoReporteSchema = z.object({
  tipo: z.enum(TIPOS_REPORTE),
});

const dias = z.coerce.number().int().min(0).max(365).default(30);

export const filtrosReporteSchema = z
  .object({
    formato: z.enum(['json', 'excel', 'pdf']).default('json'),
    empresa_id: z.uuid().optional(),
    // Se valida contra los estados de cada tipo de reporte en el servicio
    estado: z.string().trim().min(1).max(30).optional(),
    desde: fecha.optional(),
    hasta: fecha.optional(),
    // Solo para vencimientos: dias hacia adelante
    dias,
  })
  .refine((d) => !d.desde || !d.hasta || d.hasta >= d.desde, {
    message: 'La fecha hasta no puede ser anterior a la fecha desde',
    path: ['hasta'],
  });

export const dashboardSchema = z.object({ dias });

export type TipoReporte = (typeof TIPOS_REPORTE)[number];
export type FiltrosReporte = z.infer<typeof filtrosReporteSchema>;