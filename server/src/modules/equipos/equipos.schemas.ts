import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const estadoEquipo = z.enum(['activo', 'inactivo', 'bloqueado']);

const equipoBase = z.object({
  empresa_id: z.uuid(),
  codigo: z.string().trim().min(2).max(40).toUpperCase(),
  nombre: z.string().trim().min(2).max(150),
  tipo: z.string().trim().max(80).nullable().optional(),
  marca: z.string().trim().max(80).nullable().optional(),
  modelo: z.string().trim().max(80).nullable().optional(),
  numero_serie: z.string().trim().max(80).nullable().optional(),
  estado: estadoEquipo,
});

export const crearEquipoSchema = equipoBase.extend({
  estado: equipoBase.shape.estado.default('activo'),
});

export const actualizarEquipoSchema = equipoBase.partial();

export const equipoIdSchema = z.object({
  id: z.uuid(),
});

export const listarEquiposSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  empresa_id: z.uuid().optional(),
  estado: estadoEquipo.optional(),
  tipo: z.string().trim().min(1).optional(),
  ordenar_por: z.enum(['codigo', 'nombre', 'created_at']).default('codigo'),
  orden: z.enum(['asc', 'desc']).default('asc'),
});

export type CrearEquipo = z.infer<typeof crearEquipoSchema>;
export type ActualizarEquipo = z.infer<typeof actualizarEquipoSchema>;
export type ListarEquipos = z.infer<typeof listarEquiposSchema>;