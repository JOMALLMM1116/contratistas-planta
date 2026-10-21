import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// En desarrollo se lee el .env de la raiz del repositorio.
// En produccion no existe el archivo: las variables llegan desde Docker.
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), quiet: true });

const esquemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  CORS_ORIGINS: z.string().default(''),

  // Carpeta de documentos y fotos subidos. En produccion apunta a un volumen
  // de Docker para que los archivos sobrevivan a cada despliegue.
  UPLOADS_DIR: z.string().min(1).default('uploads'),
});

const resultado = esquemaEnv.safeParse(process.env);

if (!resultado.success) {
  console.error('Variables de entorno invalidas:');
  for (const issue of resultado.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = resultado.data;

export const corsOrigins = env.CORS_ORIGINS
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);
