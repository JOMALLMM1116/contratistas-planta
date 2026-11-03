import nodemailer from 'nodemailer';
import { env } from './config/env.js';
import { logger } from './logger.js';

// Solo se crea el transporte si hay servidor SMTP configurado
const transporte = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export async function enviarCorreo(para: string, asunto: string, texto: string) {
  if (!transporte) {
    if (env.NODE_ENV === 'production') {
      // En produccion nunca se escribe el contenido (puede llevar enlaces con tokens)
      logger.error({ para, asunto }, 'SMTP no configurado: el correo no se envio');
    } else {
      logger.warn({ para, asunto, texto }, 'SMTP no configurado (desarrollo): correo NO enviado, contenido en el log');
    }
    return;
  }
  await transporte.sendMail({ from: env.SMTP_FROM, to: para, subject: asunto, text: texto });
}
