import { z } from 'zod';

// Se envia el QR escaneado (token) o el codigo corto escrito a mano, uno de los dos
export const validarSchema = z
  .object({
    token: z.string().trim().min(20).max(2000).optional(),
    codigo: z.string().trim().toUpperCase().length(8).optional(),
    zona_id: z.number().int().positive(),
  })
  .refine((d) => Boolean(d.token) !== Boolean(d.codigo), {
    message: 'Envie el token del QR o el codigo corto (solo uno)',
    path: ['token'],
  });

export type Validar = z.infer<typeof validarSchema>;
