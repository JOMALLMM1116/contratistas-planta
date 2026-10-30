import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// En desarrollo se lee el .env de la raiz del repositorio.
// En produccion no existe el archivo: las variables llegan desde Docker.
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), quiet: true });

// Una variable vacia en el .env (SMTP_HOST=) se trata como no definida
const opcional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const esquemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  CORS_ORIGINS: z.string().default(''),

  // Carpeta de documentos y fotos subidos. En produccion apunta a un volumen
  // de Docker para que los archivos sobrevivan a cada despliegue.
  UPLOADS_DIR: z.string().min(1).default('uploads'),

  // Autenticacion
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  ACCESS_TOKEN_MINUTOS: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_DIAS: z.coerce.number().int().positive().default(7),

  // Correo y enlaces (recuperacion de contrasena, notificaciones)
  APP_URL: z.url().default('http://localhost:5173'),
  SMTP_HOST: opcional,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: opcional,
  SMTP_PASS: opcional,
  SMTP_FROM: z.string().default('Contratistas Planta <no-reply@planta.test>'),

  // Solo para el script de datos de demostracion
  DEMO_PASSWORD: z.string().min(8).optional(),
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
