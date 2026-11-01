import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from '../src/shared/db.js';

// Requieren las migraciones aplicadas y el seed: npm run db:seed
const app = crearApp();
const PASSWORD = process.env.DEMO_PASSWORD ?? '';
// historial_estados es de solo insercion: se usa un id fijo para no acumular filas en cada corrida
const ENTIDAD_ID = '00000000-0000-4000-8000-0000000000a1';

async function sesion(email: string) {
  const agente = request.agent(app);
  const respuesta = await agente.post('/api/auth/login').send({ email, password: PASSWORD });
  expect(respuesta.status, `login de ${email}`).toBe(200);
  return agente;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('consulta de auditoria', () => {
  let seguridad: Awaited<ReturnType<typeof sesion>>;

  beforeAll(async () => {
    seguridad = await sesion('seguridad@planta.test');

    if ((await prisma.historial_estados.count({ where: { entidad_id: ENTIDAD_ID } })) === 0) {
      const usuario = await prisma.usuarios.findUniqueOrThrow({ where: { email: 'seguridad@planta.test' }, select: { id: true } });
      await prisma.historial_estados.create({
        data: { entidad: 'solicitud', entidad_id: ENTIDAD_ID, estado_anterior: 'borrador', estado_nuevo: 'pendiente', usuario_id: usuario.id },
      });
      await prisma.historial_estados.create({
        data: { entidad: 'solicitud', entidad_id: ENTIDAD_ID, estado_anterior: 'pendiente', estado_nuevo: 'aprobada', motivo: 'Prueba automatica', usuario_id: usuario.id },
      });
    }
  });

  it('lista la auditoria ordenada por fecha descendente y paginada', async () => {
    const r = await seguridad.get('/api/auditoria?por_pagina=10');
    expect(r.status).toBe(200);
    expect(r.body.datos.length).toBeGreaterThan(0);
    expect(r.body.meta.por_pagina).toBe(10);
    const fechas: number[] = r.body.datos.map((d: { created_at: string }) => new Date(d.created_at).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
  });

  it('filtra por accion, entidad, resultado y correo', async () => {
    const porAccion = await seguridad.get('/api/auditoria?accion=LOGIN&entidad=usuarios&resultado=ok');
    expect(porAccion.status).toBe(200);
    expect(porAccion.body.datos.length).toBeGreaterThan(0);
    for (const d of porAccion.body.datos) {
      expect(d.accion).toBe('LOGIN');
      expect(d.entidad).toBe('usuarios');
      expect(d.resultado).toBe('ok');
    }

    const porCorreo = await seguridad.get('/api/auditoria?usuario_email=seguridad@planta.test');
    expect(porCorreo.body.datos.length).toBeGreaterThan(0);
    for (const d of porCorreo.body.datos) expect(d.usuario_email).toBe('seguridad@planta.test');
  });

  it('filtra por rango de fechas', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const dentro = await seguridad.get(`/api/auditoria?desde=${hoy}&hasta=${hoy}`);
    expect(dentro.status).toBe(200);
    expect(dentro.body.meta.total).toBeGreaterThan(0);

    const fuera = await seguridad.get('/api/auditoria?desde=2020-01-01&hasta=2020-01-02');
    expect(fuera.body.meta.total).toBe(0);
  });

  it('rechaza filtros invalidos', async () => {
    expect((await seguridad.get('/api/auditoria?resultado=otro')).status).toBe(400);
    expect((await seguridad.get('/api/auditoria?desde=2026-12-31&hasta=2026-01-01')).status).toBe(400);
    expect((await seguridad.get('/api/auditoria/historial?entidad=solicitud')).status).toBe(400);
  });

  it('devuelve el historial de estados, del mas reciente al mas antiguo', async () => {
    const r = await seguridad.get(`/api/auditoria/historial?entidad=solicitud&entidad_id=${ENTIDAD_ID}`);
    expect(r.status).toBe(200);
    expect(r.body.datos).toHaveLength(2);
    expect(r.body.datos[0].estado_nuevo).toBe('aprobada');
    expect(r.body.datos[0].motivo).toBe('Prueba automatica');
    expect(r.body.datos[0].usuario.email).toBe('seguridad@planta.test');
    expect(r.body.datos[1].estado_nuevo).toBe('pendiente');
  });

  it('un historial sin cambios responde una lista vacia', async () => {
    const r = await seguridad.get('/api/auditoria/historial?entidad=solicitud&entidad_id=00000000-0000-4000-8000-000000000000');
    expect(r.status).toBe(200);
    expect(r.body.datos).toEqual([]);
  });

  it('exige el permiso auditoria.ver', async () => {
    const garita = await sesion('garita@planta.test');
    expect((await garita.get('/api/auditoria')).status).toBe(403);
    expect((await garita.get('/api/auditoria/historial?entidad=solicitud&entidad_id=00000000-0000-4000-8000-000000000000')).status).toBe(403);
    expect((await request(app).get('/api/auditoria')).status).toBe(401);
  });
});