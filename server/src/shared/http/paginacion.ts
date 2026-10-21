import { z } from 'zod';

// Parametros comunes de paginacion para cualquier listado
export const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(100).default(20),
});

export type Paginacion = z.infer<typeof esquemaPaginacion>;

// Convierte pagina/por_pagina en skip/take para Prisma
export function paginar({ pagina, por_pagina }: Paginacion) {
  return { skip: (pagina - 1) * por_pagina, take: por_pagina };
}

// Formato estandar de respuesta para listados
export function respuestaPaginada<T>(datos: T[], total: number, { pagina, por_pagina }: Paginacion) {
  return {
    datos,
    meta: {
      total,
      pagina,
      por_pagina,
      total_paginas: Math.ceil(total / por_pagina),
    },
  };
}
