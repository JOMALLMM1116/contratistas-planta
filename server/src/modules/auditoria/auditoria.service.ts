import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { paginar } from '../../shared/http/paginacion.js';
import type { FiltroHistorial, ListarAuditoria } from './auditoria.schemas.js';

// Solo lectura: las tablas de auditoria e historial son de solo insercion (triggers)
export async function listar(filtros: ListarAuditoria) {
  const where: Prisma.auditoriaWhereInput = {};

  if (filtros.usuario_email) where.usuario_email = { contains: filtros.usuario_email, mode: 'insensitive' };
  if (filtros.accion) where.accion = { contains: filtros.accion, mode: 'insensitive' };
  if (filtros.entidad) where.entidad = filtros.entidad;
  if (filtros.resultado) where.resultado = filtros.resultado;
  if (filtros.desde || filtros.hasta) {
    where.created_at = { ...(filtros.desde ? { gte: filtros.desde } : {}), ...(filtros.hasta ? { lte: filtros.hasta } : {}) };
  }

  const [total, datos] = await prisma.$transaction([
    prisma.auditoria.count({ where }),
    prisma.auditoria.findMany({ where, orderBy: { created_at: 'desc' }, ...paginar(filtros) }),
  ]);

  // El id es bigint y no se serializa a JSON
  return { datos: datos.map((d) => ({ ...d, id: Number(d.id) })), total };
}

// Cambios de estado de una solicitud, permiso, credencial o incidente, del mas reciente al mas antiguo
export async function historial({ entidad, entidad_id }: FiltroHistorial) {
  const filas = await prisma.historial_estados.findMany({
    where: { entidad, entidad_id },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    include: { usuarios: { select: { id: true, email: true, nombre_completo: true } } },
  });

  return filas.map(({ usuarios, ...fila }) => ({ ...fila, id: Number(fila.id), usuario: usuarios }));
}