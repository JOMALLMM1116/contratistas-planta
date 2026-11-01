import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from '../src/shared/db.js';

// Requieren las migraciones aplicadas y el seed: npm run db:seed
const app = crearApp();
const PASSWORD = process.env.DEMO_PASSWORD ?? '';
const correoPrueba = `prueba.usuarios.${Date.now()}@planta.test`;
const passwordInicial = 'PruebaInicial2026';

async function sesion(email: string, password = PASSWORD) {
  const agente = request.agent(app);
  const respuesta = await agente.post('/api/auth/login').send({ email, password });
  expect(respuesta.status, `login de ${email}`).toBe(200);
  return agente;
}

async function sesionesAbiertas(usuarioId: string) {
  return prisma.sesiones.count({ where: { usuario_id: usuarioId, revocada_en: null } });
}

afterAll(async () => {
  await prisma.usuarios.deleteMany({ where: { email: correoPrueba } });
  await prisma.$disconnect();
});

describe('usuarios y roles', () => {
  let admin: Awaited<ReturnType<typeof sesion>>;
  let adminId: string;
  let rolContratistaId: number;
  let rolSeguridadId: number;
  let empresaId: string;
  let nuevoId: string;

  beforeAll(async () => {
    admin = await sesion('admin@planta.test');
    adminId = (await prisma.usuarios.findUniqueOrThrow({ where: { email: 'admin@planta.test' }, select: { id: true } })).id;
    const roles = await admin.get('/api/roles');
    expect(roles.status).toBe(200);
    rolContratistaId = roles.body.datos.find((r: { codigo: string }) => r.codigo === 'contratista').id;
    rolSeguridadId = roles.body.datos.find((r: { codigo: string }) => r.codigo === 'seguridad_industrial').id;
    empresaId = (await prisma.usuarios.findUniqueOrThrow({ where: { email: 'supervisor@empresa.test' } })).empresa_id!;
  });

  it('GET /api/roles lista los roles con sus permisos', async () => {
    const r = await admin.get('/api/roles');
    const seguridad = r.body.datos.find((x: { codigo: string }) => x.codigo === 'seguridad_industrial');
    expect(seguridad.permisos.length).toBeGreaterThan(0);
    expect(seguridad.permisos[0]).toHaveProperty('codigo');
  });

  it('el listado nunca expone el hash de la contrasena', async () => {
    const r = await admin.get('/api/usuarios?por_pagina=100');
    expect(r.status).toBe(200);
    expect(r.body.meta.total).toBeGreaterThanOrEqual(6);
    const texto = JSON.stringify(r.body);
    expect(texto).not.toContain('password_hash');
    expect(texto).not.toContain('argon2');
  });

  it('garita no puede gestionar usuarios ni ver los roles', async () => {
    const garita = await sesion('garita@planta.test');
    expect((await garita.get('/api/usuarios')).status).toBe(403);
    expect((await garita.get('/api/roles')).status).toBe(403);
  });

  it('el administrador no puede desactivarse, cambiar su rol ni restablecer su propia contrasena', async () => {
    const desactivarse = await admin.patch(`/api/usuarios/${adminId}`).send({ activo: false });
    expect(desactivarse.status).toBe(409);
    expect(desactivarse.body.error.code).toBe('OPERACION_SOBRE_SI_MISMO');

    expect((await admin.patch(`/api/usuarios/${adminId}`).send({ rol_id: rolSeguridadId })).status).toBe(409);
    expect((await admin.post(`/api/usuarios/${adminId}/restablecer-password`)).status).toBe(409);

    const sigueAdmin = await prisma.usuarios.findUniqueOrThrow({ where: { id: adminId }, include: { roles: true } });
    expect(sigueAdmin.activo).toBe(true);
    expect(sigueAdmin.roles.codigo).toBe('admin');
  });

  it('un rol externo exige empresa', async () => {
    const r = await admin
      .post('/api/usuarios')
      .send({ email: correoPrueba, nombre_completo: 'Usuario de prueba', rol_id: rolContratistaId, password: passwordInicial });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('EMPRESA_REQUERIDA');
  });

  it('crea un usuario externo que puede iniciar sesion y no se repite el correo', async () => {
    const creado = await admin.post('/api/usuarios').send({
      email: correoPrueba,
      nombre_completo: 'Usuario de prueba',
      rol_id: rolContratistaId,
      empresa_id: empresaId,
      password: passwordInicial,
    });
    expect(creado.status).toBe(201);
    expect(JSON.stringify(creado.body)).not.toContain('password_hash');
    nuevoId = creado.body.datos.id;

    const login = await request(app).post('/api/auth/login').send({ email: correoPrueba, password: passwordInicial });
    expect(login.status).toBe(200);

    const duplicado = await admin.post('/api/usuarios').send({
      email: correoPrueba,
      nombre_completo: 'Otro usuario',
      rol_id: rolContratistaId,
      empresa_id: empresaId,
      password: passwordInicial,
    });
    expect(duplicado.status).toBe(409);
  });

  it('desactivar cierra de inmediato las sesiones del usuario y queda auditado', async () => {
    const usuarioPrueba = await sesion(correoPrueba, passwordInicial);
    expect(await sesionesAbiertas(nuevoId)).toBeGreaterThan(0);

    const desactivado = await admin.patch(`/api/usuarios/${nuevoId}`).send({ activo: false });
    expect(desactivado.status).toBe(200);
    expect(desactivado.body.datos.activo).toBe(false);
    expect(await sesionesAbiertas(nuevoId)).toBe(0);
    expect((await usuarioPrueba.post('/api/auth/refresh')).status).toBe(401);
    expect(await prisma.auditoria.count({ where: { accion: 'USUARIO_ACTUALIZADO', entidad_id: nuevoId } })).toBeGreaterThanOrEqual(1);

    const reactivado = await admin.patch(`/api/usuarios/${nuevoId}`).send({ activo: true });
    expect(reactivado.status).toBe(200);
  });

  it('cambiar el rol cierra las sesiones, queda auditado y un rol interno no guarda empresa', async () => {
    await sesion(correoPrueba, passwordInicial);
    expect(await sesionesAbiertas(nuevoId)).toBeGreaterThan(0);

    const r = await admin.patch(`/api/usuarios/${nuevoId}`).send({ rol_id: rolSeguridadId, empresa_id: empresaId });
    expect(r.status).toBe(200);
    expect(r.body.datos.roles.codigo).toBe('seguridad_industrial');
    expect(r.body.datos.empresa_id).toBeNull();
    expect(await sesionesAbiertas(nuevoId)).toBe(0);
    expect(await prisma.auditoria.count({ where: { accion: 'USUARIO_ROL_CAMBIADO', entidad_id: nuevoId } })).toBeGreaterThanOrEqual(1);
  });

  it('restablecer la contrasena cierra las sesiones, entrega una temporal y obliga a cambiarla', async () => {
    const usuarioPrueba = await sesion(correoPrueba, passwordInicial);

    const r = await admin.post(`/api/usuarios/${nuevoId}/restablecer-password`);
    expect(r.status).toBe(200);
    const temporal: string = r.body.datos.password_temporal;
    expect(temporal).toHaveLength(12);
    expect(r.body.datos.usuario.debe_cambiar_password).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain('password_hash');

    // La sesion abierta con la contrasena anterior ya no sirve
    expect(await sesionesAbiertas(nuevoId)).toBe(0);
    expect((await usuarioPrueba.post('/api/auth/refresh')).status).toBe(401);

    const anterior = await request(app).post('/api/auth/login').send({ email: correoPrueba, password: passwordInicial });
    expect(anterior.status).toBe(401);
    const nueva = await request(app).post('/api/auth/login').send({ email: correoPrueba, password: temporal });
    expect(nueva.status).toBe(200);
  });
});
