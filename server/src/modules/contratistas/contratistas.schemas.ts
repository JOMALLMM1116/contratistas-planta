import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const estadoContratista = z.enum(['activo', 'inactivo']);
const email = z.string().trim().max(254).pipe(z.email());

const contratistaBase = z.object({
  empresa_id: z.uuid(),
  // Cuenta de acceso (modulo de usuarios); opcional
  usuario_id: z.uuid().nullable().optional(),
  documento_identidad: z.string().trim().min(5).max(30),
  nombres: z.string().trim().min(2).max(100),
  apellidos: z.string().trim().min(2).max(100),
  email: email.nullable().optional(),
  telefono: z.string().trim().max(30).nullable().optional(),
  cargo: z.string().trim().max(100).nullable().optional(),
  estado: estadoContratista,
});

export const crearContratistaSchema = contratistaBase.extend({
  estado: contratistaBase.shape.estado.default('activo'),
});

export const actualizarContratistaSchema = contratistaBase.partial();

export const contratistaIdSchema = z.object({
  id: z.uuid(),
});

export const listarContratistasSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  empresa_id: z.uuid().optional(),
  estado: estadoContratista.optional(),
  ordenar_por: z.enum(['apellidos', 'nombres', 'documento_identidad', 'created_at']).default('apellidos'),
  orden: z.enum(['asc', 'desc']).default('asc'),
});

export type CrearContratista = z.infer<typeof crearContratistaSchema>;
export type ActualizarContratista = z.infer<typeof actualizarContratistaSchema>;
export type ListarContratistas = z.infer<typeof listarContratistasSchema>;