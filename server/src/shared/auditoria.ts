import type { Request } from 'express';
import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from './db.js';
import { logger } from './logger.js';

type EventoAuditoria = {
  accion: string;
  entidad?: string;
  entidad_id?: string | number | null;
  resultado?: 'ok' | 'denegado' | 'error';
  datos_antes?: unknown;
  datos_despues?: unknown;
  // Si no se indica, se toma el usuario de la sesion (req.usuario)
  usuario?: { id: string; email: string } | null;
};

// Registra un evento en la tabla de auditoria (solo insercion).
// Nunca lanza error: si la auditoria falla, se deja en el log y la operacion sigue.
export async function registrarAuditoria(req: Request | null, evento: EventoAuditoria) {
  const usuario = evento.usuario ?? req?.usuario ?? null;

  try {
    await prisma.auditoria.create({
      data: {
        usuario_id: usuario?.id ?? null,
        usuario_email: usuario?.email ?? null,
        accion: evento.accion,
        entidad: evento.entidad ?? null,
        entidad_id: evento.entidad_id != null ? String(evento.entidad_id) : null,
        resultado: evento.resultado ?? 'ok',
        datos_antes: (evento.datos_antes ?? undefined) as Prisma.InputJsonValue | undefined,
        datos_despues: (evento.datos_despues ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: req?.ip ?? null,
        user_agent: req?.get('user-agent') ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, accion: evento.accion }, 'No se pudo registrar la auditoria');
  }
}

