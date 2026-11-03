import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

// Misma regla que el modulo de auth
const password = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .max(100)
  .regex(/[A-Za-z]/, 'La contrasena debe incluir al menos una letra')
  .regex(/\d/, 'La contrasena debe incluir al menos un numero');

export const crearUsuarioSchema = z.object({
  email,
  nombre_completo: z.string().trim().min(3).max(150),
  rol_id: z.number().int().positive(),
  // Obligatoria si el rol es externo
  empresa_id: z.uuid().nullable().optional(),
  password,
});

export const actualizarUsuarioSchema = z
  .object({
    nombre_completo: z.string().trim().min(3).max(150).optional(),
    rol_id: z.number().int().positive().optional(),
    empresa_id: z.uuid().nullable().optional(),
    activo: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Indique al menos un campo a modificar' });

export const usuarioIdSchema = z.object({
  id: z.uuid(),
});

export const listarUsuariosSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  rol_id: z.coerce.number().int().positive().optional(),
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  empresa_id: z.uuid().optional(),
  ordenar_por: z.enum(['nombre_completo', 'email', 'created_at', 'ultimo_acceso']).default('nombre_completo'),
  orden: z.enum(['asc', 'desc']).default('asc'),
});

export type CrearUsuario = z.infer<typeof crearUsuarioSchema>;
export type ActualizarUsuario = z.infer<typeof actualizarUsuarioSchema>;
export type ListarUsuarios = z.infer<typeof listarUsuariosSchema>;