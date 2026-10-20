import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Igual que el backend: el .env vive en la raiz del repositorio
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), quiet: true });

// IMPORTANTE: las migraciones las maneja dbmate (db/migrations).
// Nunca usar `prisma migrate` ni `prisma db push` en este proyecto.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
