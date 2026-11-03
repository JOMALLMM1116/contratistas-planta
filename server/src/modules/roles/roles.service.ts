import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';

// Roles con sus permisos, para los selectores del frontend
export async function listar() {
  const roles = await prisma.roles.findMany({
    orderBy: { id: 'asc' },
    include: { rol_permisos: { include: { permisos: { select: { codigo: true, descripcion: true } } } } },
  });

  return roles.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    descripcion: r.descripcion,
    es_interno: r.es_interno,
    permisos: r.rol_permisos.map((rp) => rp.permisos).sort((a, b) => a.codigo.localeCompare(b.codigo)),
  }));
}

export async function obtener(id: number) {
  const rol = await prisma.roles.findUnique({ where: { id } });
  if (!rol) throw new AppError(404, 'ROL_NO_ENCONTRADO', `No existe el rol ${id}`);
  return rol;
}