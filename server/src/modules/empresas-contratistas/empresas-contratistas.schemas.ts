import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/http/paginacion.js';

const estadoEmpresa = z.enum(['activa', 'inactiva']);
const email = z.string().trim().max(254).pipe(z.email());

const empresaBase = z.object({
  nit: z.string().trim().min(2).max(20).toUpperCase(),
  razon_social: z.string().trim().min(2).max(200),
  nombre_contacto: z.string().trim().max(150).nullable().optional(),
  email_contacto: email.nullable().optional(),
  telefono: z.string().trim().max(30).nullable().optional(),
  direccion: z.string().trim().max(500).nullable().optional(),
  estado: estadoEmpresa,
});

export const crearEmpresaSchema = empresaBase.extend({
  estado: empresaBase.shape.estado.default('activa'),
});

export const actualizarEmpresaSchema = empresaBase.partial();

export const empresaIdSchema = z.object({
  id: z.uuid(),
});

export const listarEmpresasSchema = esquemaPaginacion.extend({
  buscar: z.string().trim().min(1).optional(),
  estado: estadoEmpresa.optional(),
  ordenar_por: z.enum(['razon_social', 'nit', 'created_at']).default('razon_social'),
  orden: z.enum(['asc', 'desc']).default('asc'),
});

export type CrearEmpresa = z.infer<typeof crearEmpresaSchema>;
export type ActualizarEmpresa = z.infer<typeof actualizarEmpresaSchema>;
export type ListarEmpresas = z.infer<typeof listarEmpresasSchema>;