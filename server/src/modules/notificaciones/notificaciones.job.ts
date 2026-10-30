import cron from 'node-cron';
import { logger } from '../../shared/logger.js';
import { ejecutarRevision } from './notificaciones.revision.js';

// Todos los dias a las 6:00, hora de Guatemala
export const HORARIO_REVISION = '0 6 * * *';

export function iniciarJobNotificaciones() {
  cron.schedule(
    HORARIO_REVISION,
    async () => {
      try {
        const resultado = await ejecutarRevision();
        logger.info(resultado, 'Revision de vencimientos terminada');
      } catch (err) {
        logger.error({ err }, 'Fallo la revision de vencimientos');
      }
    },
    { timezone: 'America/Guatemala' },
  );
  logger.info(`Revision de vencimientos programada (${HORARIO_REVISION}, America/Guatemala)`);
}