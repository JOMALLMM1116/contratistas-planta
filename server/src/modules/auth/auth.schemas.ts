import { z } from 'zod';

// Politica minima: 8 caracteres, al menos una letra y un numero
const passwordSegura = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .max(200)
  .regex(/[A-Za-z]/, 'La contrasena debe incluir al menos una letra')
  .regex(/\d/, 'La contrasena debe incluir al menos un numero');

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(200),
});

export const recuperarSchema = z.object({
  email: z.email().max(255),
});

export const restablecerSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSegura,
});

export const cambiarPasswordSchema = z
  .object({
    actual: z.string().min(1).max(200),
    nueva: passwordSegura,
  })
  .refine((d) => d.actual !== d.nueva, {
    message: 'La nueva contrasena debe ser distinta de la actual',
    path: ['nueva'],
  });
