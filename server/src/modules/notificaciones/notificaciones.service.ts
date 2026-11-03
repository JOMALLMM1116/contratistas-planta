import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import type { ListarNotificaciones } from './notificaciones.schemas.js';

export type NuevaNotificacion = {
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  entidad: string;
  entidad_id: string;
};

export async function listar(filtros: ListarNotificaciones) {
  const where: Prisma.notificacionesWhereInput = { usuario_id: filtros.usuario_id };

  if (filtros.leida !== undefined) where.leida_en = filtros.leida ? { not: null } : null;
  if (filtros.tipo) where.tipo = filtros.tipo;

  const [total, datos] = await prisma.$transaction([
    prisma.notificaciones.count({ where }),
    prisma.notificaciones.findMany({ where, orderBy: { created_at: 'desc' }, ...paginar(filtros) }),
  ]);

  return { datos, total };
}

export async function contarNoLeidas(usuarioId: string) {
  const no_leidas = await prisma.notificaciones.count({ where: { usuario_id: usuarioId, leida_en: null } });
  return { no_leidas };
}

export async function marcarLeida(id: string, usuarioId: string) {
  // Se filtra por usuario: una notificacion ajena responde 404 y no revela que existe
  const notificacion = await prisma.notificaciones.findFirst({ where: { id, usuario_id: usuarioId } });
  if (!notificacion) throw new AppError(404, 'NOTIFICACION_NO_ENCONTRADA', `No existe la notificacion ${id}`);
  if (notificacion.leida_en) return notificacion;

  return prisma.notificaciones.update({ where: { id }, data: { leida_en: new Date() } });
}

export async function marcarTodasLeidas(usuarioId: string) {
  const { count } = await prisma.notificaciones.updateMany({
    where: { usuario_id: usuarioId, leida_en: null },
    data: { leida_en: new Date() },
  });
  return { marcadas: count };
}

// La tabla no tiene columna para evitar duplicados: una notificacion por usuario, tipo y entidad
export async function crearSinDuplicar(items: NuevaNotificacion[]) {
  if (items.length === 0) return 0;

  const existentes = await prisma.notificaciones.findMany({
    where: {
      tipo: { in: [...new Set(items.map((i) => i.tipo))] },
      entidad_id: { in: [...new Set(items.map((i) => i.entidad_id))] },
    },
    select: { usuario_id: true, tipo: true, entidad_id: true },
  });

  const claves = new Set(existentes.map((e) => `${e.usuario_id}|${e.tipo}|${e.entidad_id}`));
  const nuevas = items.filter((i) => {
    const clave = `${i.usuario_id}|${i.tipo}|${i.entidad_id}`;
    if (claves.has(clave)) return false;
    claves.add(clave);
    return true;
  });
  if (nuevas.length === 0) return 0;

  const { count } = await prisma.notificaciones.createMany({ data: nuevas });
  return count;
}