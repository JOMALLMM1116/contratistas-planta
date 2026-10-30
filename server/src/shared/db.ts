import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './config/env.js';

// Prisma 7 exige un driver adapter; usamos el de PostgreSQL (node-postgres).
// Prisma envia las fechas en UTC pero sin indicar la zona horaria. Con la sesion
// en UTC, PostgreSQL las interpreta correctamente. Las funciones SQL de negocio
// usan America/Guatemala de forma explicita, asi que no se ven afectadas.
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  options: '-c TimeZone=UTC',
});

// Una sola instancia para toda la aplicacion
export const prisma = new PrismaClient({ adapter });
