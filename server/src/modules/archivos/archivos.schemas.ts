import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

export const archivoIdSchema = z.object({
  id: z.uuid(),
});

export const listarArchivosSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png']).optional(),
  ordenar_por: z.enum(['created_at', 'nombre_original', 'tamano_bytes']).default('created_at'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type ListarArchivos = z.infer<typeof listarArchivosSchema>;