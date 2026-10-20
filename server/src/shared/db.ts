import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './config/env.js';

// Prisma 7 exige un driver adapter; usamos el de PostgreSQL (node-postgres)
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// Una sola instancia para toda la aplicacion
export const prisma = new PrismaClient({ adapter });

