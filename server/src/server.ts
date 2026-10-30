import { crearApp } from './app.js';
import { env } from './shared/config/env.js';
import { logger } from './shared/logger.js';
import { prisma } from './shared/db.js';
import { iniciarJobNotificaciones } from './modules/notificaciones/notificaciones.job.js';

const app = crearApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.PORT}`);
  // Tareas programadas (revision diaria de vencimientos)
  iniciarJobNotificaciones();
});

server.on('error', (err) => {
  logger.fatal({ err }, 'No se pudo iniciar el servidor');
  process.exit(1);
});

// Cierre ordenado: Docker envia SIGTERM al detener el contenedor
function apagar(senal: string) {
  logger.info(`${senal} recibido, cerrando servidor`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));