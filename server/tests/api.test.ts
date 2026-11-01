import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from '../src/shared/db.js';

// Pruebas de integracion contra la API real y una base de datos real.
// Requieren las migraciones aplicadas y los seeds: npm run db:seed y npm run db:seed:flujo
const app = crearApp();
const PASSWORD = process.env.DEMO_PASSWORD ?? '';

async function sesion(email: string) {
  const agente = request.agent(app);
  const respuesta = await agente.post('/api/auth/login').send({ email, password: PASSWORD });
  expect(respuesta.status, `login de ${email}`).toBe(200);
  return agente;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('salud del sistema', () => {
  it('responde y tiene la base de datos conectada', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.baseDatos).toBe('ok');
  });
});

describe('autenticacion', () => {
  it('rechaza credenciales incorrectas', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'noexiste@planta.test', password: 'Incorrecta123' });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('CREDENCIALES_INVALIDAS');
  });

  it('el login entrega la sesion en cookies HttpOnly y SameSite=Strict', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'admin@planta.test', password: PASSWORD });
    expect(r.status).toBe(200);
    const cookies = ([] as string[]).concat(r.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith('cp_access=') && c.includes('HttpOnly') && c.includes('SameSite=Strict'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('cp_refresh='))).toBe(true);
  });

  it('las rutas protegidas exigen sesion', async () => {
    const r = await request(app).get('/api/zonas');
    expect(r.status).toBe(401);
  });
});

describe('roles y permisos', () => {
  it('garita no puede crear zonas', async () => {
    const garita = await sesion('garita@planta.test');
    const r = await garita.post('/api/zonas').send({ codigo: 'Z-TEST', nombre: 'Zona de prueba' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('SIN_PERMISO');
  });

  it('garita no puede consultar solicitudes', async () => {
    const garita = await sesion('garita@planta.test');
    const r = await garita.get('/api/solicitudes');
    expect(r.status).toBe(403);
  });
});

describe('credenciales temporales y garita', () => {
  let seguridad: Awaited<ReturnType<typeof sesion>>;
  let garita: Awaited<ReturnType<typeof sesion>>;
  let solicitudId: string;
  let contratistaId: string;
  let zonaAutorizada: number;
  let zonaNoAutorizada: number;

  beforeAll(async () => {
    seguridad = await sesion('seguridad@planta.test');
    garita = await sesion('garita@planta.test');

    const solicitud = await prisma.solicitudes_acceso.findFirstOrThrow({
      where: { descripcion_actividad: { contains: 'flujo de demostracion' }, estado: 'aprobada' },
    });
    const contratista = await prisma.contratistas.findUniqueOrThrow({ where: { documento_identidad: '1234567890101' } });
    solicitudId = solicitud.id;
    contratistaId = contratista.id;
    zonaAutorizada = (await prisma.zonas.findUniqueOrThrow({ where: { codigo: 'Z-BOD' } })).id;
    zonaNoAutorizada = (await prisma.zonas.findUniqueOrThrow({ where: { codigo: 'Z-PROD' } })).id;

    // Deja el escenario limpio si se corre en una base con datos previos
    const activas = await prisma.credenciales.findMany({
      where: { solicitud_id: solicitudId, contratista_id: contratistaId, estado: 'activa' },
    });
    for (const c of activas) {
      await seguridad.post(`/api/credenciales/${c.id}/revocar`).send({ motivo: 'Limpieza antes de las pruebas automaticas' });
    }
    await garita.post('/api/garita/salida').send({ contratista_id: contratistaId });
  });

  it('emite, valida, registra la entrada y luego responde "usado"', async () => {
    const emitida = await seguridad
      .post('/api/credenciales')
      .send({ solicitud_id: solicitudId, contratista_id: contratistaId, usos_maximos: 1 });
    expect(emitida.status).toBe(201);
    const token: string = emitida.body.datos.token;
    expect(emitida.body.datos.codigo_corto).toHaveLength(8);

    const valida = await garita.post('/api/garita/validar').send({ token, zona_id: zonaAutorizada });
    expect(valida.body.datos.resultado).toBe('valido');

    const otraZona = await garita.post('/api/garita/validar').send({ token, zona_id: zonaNoAutorizada });
    expect(otraZona.body.datos.resultado).toBe('zona_no_autorizada');

    const alterado = await garita.post('/api/garita/validar').send({ token: `${token.slice(0, -2)}xx`, zona_id: zonaAutorizada });
    expect(alterado.body.datos.resultado).toBe('invalido');

    const entrada = await garita.post('/api/garita/entrada').send({ token, zona_id: zonaAutorizada });
    expect(entrada.status).toBe(201);
    expect(entrada.body.datos.credencial.estado).toBe('usada');

    const usada = await garita.post('/api/garita/validar').send({ token, zona_id: zonaAutorizada });
    expect(usada.body.datos.resultado).toBe('usado');

    const salida = await garita.post('/api/garita/salida').send({ contratista_id: contratistaId });
    expect(salida.status).toBe(201);
  });

  it('una credencial revocada responde "revocado"', async () => {
    const emitida = await seguridad.post('/api/credenciales').send({ solicitud_id: solicitudId, contratista_id: contratistaId });
    expect(emitida.status).toBe(201);

    const revocada = await seguridad
      .post(`/api/credenciales/${emitida.body.datos.id}/revocar`)
      .send({ motivo: 'Prueba automatica de revocacion' });
    expect(revocada.status).toBe(200);

    const r = await garita.post('/api/garita/validar').send({ token: emitida.body.datos.token, zona_id: zonaAutorizada });
    expect(r.body.datos.resultado).toBe('revocado');
  });
});
