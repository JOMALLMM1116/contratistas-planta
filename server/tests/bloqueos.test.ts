import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from '../src/shared/db.js';

// Requieren las migraciones aplicadas y los seeds: npm run db:seed y npm run db:seed:flujo
const app = crearApp();
const PASSWORD = process.env.DEMO_PASSWORD ?? '';
const marca = `Prueba automatica ${Date.now()}`;

async function sesion(email: string) {
  const agente = request.agent(app);
  const respuesta = await agente.post('/api/auth/login').send({ email, password: PASSWORD });
  expect(respuesta.status, `login de ${email}`).toBe(200);
  return agente;
}

afterAll(async () => {
  // Por seguridad, ningun bloqueo de prueba debe quedar activo
  await prisma.bloqueos.updateMany({
    where: { motivo: { startsWith: marca }, levantado_en: null },
    data: { levantado_en: new Date(), levantado_por: (await prisma.usuarios.findFirstOrThrow({ select: { id: true } })).id, motivo_levantamiento: 'Limpieza' },
  });
  await prisma.$disconnect();
});

describe('bloqueos', () => {
  let seguridad: Awaited<ReturnType<typeof sesion>>;
  let contratistaId: string;
  let empresaId: string;
  let seguridadId: string;
  let bloqueoContratistaId: string;

  beforeAll(async () => {
    seguridad = await sesion('seguridad@planta.test');
    seguridadId = (await prisma.usuarios.findUniqueOrThrow({ where: { email: 'seguridad@planta.test' }, select: { id: true } })).id;
    const contratista = await prisma.contratistas.findUniqueOrThrow({ where: { documento_identidad: '1234567890101' } });
    contratistaId = contratista.id;
    empresaId = contratista.empresa_id;
  });

  it('exige el permiso bloqueos.gestionar', async () => {
    const garita = await sesion('garita@planta.test');
    expect((await garita.get('/api/bloqueos')).status).toBe(403);
    expect((await garita.post('/api/bloqueos').send({})).status).toBe(403);
    expect((await request(app).get('/api/bloqueos')).status).toBe(401);
  });

  it('exige exactamente un objetivo: contratista o empresa', async () => {
    const ninguno = await seguridad.post('/api/bloqueos').send({ tipo: 'manual', motivo: `${marca}: sin objetivo` });
    expect(ninguno.status).toBe(400);

    const ambos = await seguridad
      .post('/api/bloqueos')
      .send({ tipo: 'manual', motivo: `${marca}: dos objetivos`, contratista_id: contratistaId, empresa_id: empresaId });
    expect(ambos.status).toBe(400);

    const tipoInvalido = await seguridad.post('/api/bloqueos').send({ tipo: 'otro', motivo: `${marca}: tipo`, contratista_id: contratistaId });
    expect(tipoInvalido.status).toBe(400);
  });

  it('bloquea a un contratista: creado_por sale de la sesion y queda auditado', async () => {
    const otro = await prisma.usuarios.findUniqueOrThrow({ where: { email: 'admin@planta.test' }, select: { id: true } });
    const r = await seguridad
      .post('/api/bloqueos')
      .send({ tipo: 'manual', motivo: `${marca}: bloqueo de contratista`, contratista_id: contratistaId, creado_por: otro.id });
    expect(r.status).toBe(201);
    expect(r.body.datos.activo).toBe(true);
    expect(r.body.datos.creado_por).toBe(seguridadId);
    expect(r.body.datos.creado_por_usuario.email).toBe('seguridad@planta.test');
    bloqueoContratistaId = r.body.datos.id;

    expect(await prisma.auditoria.count({ where: { accion: 'BLOQUEO_CREADO', entidad_id: bloqueoContratistaId } })).toBeGreaterThanOrEqual(1);
  });

  it('fn_contratista_bloqueado refleja el bloqueo', async () => {
    const [fila] = await prisma.$queryRaw<{ bloqueado: boolean }[]>`SELECT fn_contratista_bloqueado(${contratistaId}::uuid) AS bloqueado`;
    expect(fila?.bloqueado).toBe(true);
  });

  it('valida que existan el contratista, la empresa y el incidente', async () => {
    const noExiste = '00000000-0000-4000-8000-000000000000';
    expect((await seguridad.post('/api/bloqueos').send({ tipo: 'manual', motivo: `${marca}: x`, contratista_id: noExiste })).status).toBe(404);
    expect((await seguridad.post('/api/bloqueos').send({ tipo: 'manual', motivo: `${marca}: x`, empresa_id: noExiste })).status).toBe(404);
    expect(
      (await seguridad.post('/api/bloqueos').send({ tipo: 'incidente', motivo: `${marca}: x`, contratista_id: contratistaId, incidente_id: noExiste })).status,
    ).toBe(404);
  });

  it('lista activos e historial con filtros', async () => {
    const activos = await seguridad.get(`/api/bloqueos?activo=true&contratista_id=${contratistaId}`);
    expect(activos.status).toBe(200);
    expect(activos.body.datos.some((b: { id: string }) => b.id === bloqueoContratistaId)).toBe(true);
    for (const b of activos.body.datos) expect(b.activo).toBe(true);

    const historial = await seguridad.get(`/api/bloqueos?activo=false&contratista_id=${contratistaId}`);
    expect(historial.body.datos.some((b: { id: string }) => b.id === bloqueoContratistaId)).toBe(false);

    const porTipo = await seguridad.get('/api/bloqueos?tipo=manual');
    expect(porTipo.status).toBe(200);
    expect((await seguridad.get('/api/bloqueos?tipo=otro')).status).toBe(400);
  });

  it('levantar exige motivo, usa la sesion y no se repite', async () => {
    expect((await seguridad.post(`/api/bloqueos/${bloqueoContratistaId}/levantar`).send({})).status).toBe(400);

    const otro = await prisma.usuarios.findUniqueOrThrow({ where: { email: 'admin@planta.test' }, select: { id: true } });
    const r = await seguridad
      .post(`/api/bloqueos/${bloqueoContratistaId}/levantar`)
      .send({ motivo: 'Situacion resuelta', levantado_por: otro.id });
    expect(r.status).toBe(200);
    expect(r.body.datos.activo).toBe(false);
    expect(r.body.datos.levantado_por).toBe(seguridadId);
    expect(r.body.datos.motivo_levantamiento).toBe('Situacion resuelta');
    expect(await prisma.auditoria.count({ where: { accion: 'BLOQUEO_LEVANTADO', entidad_id: bloqueoContratistaId } })).toBeGreaterThanOrEqual(1);

    const repetido = await seguridad.post(`/api/bloqueos/${bloqueoContratistaId}/levantar`).send({ motivo: 'Otra vez' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe('BLOQUEO_YA_LEVANTADO');

    const [fila] = await prisma.$queryRaw<{ bloqueado: boolean }[]>`SELECT fn_contratista_bloqueado(${contratistaId}::uuid) AS bloqueado`;
    expect(fila?.bloqueado).toBe(false);
  });

  it('un bloqueo de empresa alcanza a todos sus contratistas', async () => {
    const r = await seguridad.post('/api/bloqueos').send({ tipo: 'manual', motivo: `${marca}: bloqueo de empresa`, empresa_id: empresaId });
    expect(r.status).toBe(201);
    expect(r.body.datos.empresa.id).toBe(empresaId);

    const [fila] = await prisma.$queryRaw<{ bloqueado: boolean }[]>`SELECT fn_contratista_bloqueado(${contratistaId}::uuid) AS bloqueado`;
    expect(fila?.bloqueado).toBe(true);

    const levantado = await seguridad.post(`/api/bloqueos/${r.body.datos.id}/levantar`).send({ motivo: 'Fin de la prueba' });
    expect(levantado.status).toBe(200);
  });
});

describe('bloqueos y garita', () => {
  it('una credencial responde "bloqueado" mientras exista el bloqueo y vuelve a "valido" al levantarlo', async () => {
    const seguridad = await sesion('seguridad@planta.test');
    const garita = await sesion('garita@planta.test');

    const solicitud = await prisma.solicitudes_acceso.findFirstOrThrow({
      where: { descripcion_actividad: { contains: 'flujo de demostracion' }, estado: 'aprobada' },
    });
    const contratista = await prisma.contratistas.findUniqueOrThrow({ where: { documento_identidad: '1234567890101' } });
    const zona = await prisma.zonas.findUniqueOrThrow({ where: { codigo: 'Z-BOD' } });

    // Escenario limpio: se revocan las credenciales activas previas
    const activas = await prisma.credenciales.findMany({
      where: { solicitud_id: solicitud.id, contratista_id: contratista.id, estado: 'activa' },
    });
    for (const c of activas) {
      await seguridad.post(`/api/credenciales/${c.id}/revocar`).send({ motivo: 'Limpieza antes de la prueba de bloqueos' });
    }

    const emitida = await seguridad.post('/api/credenciales').send({ solicitud_id: solicitud.id, contratista_id: contratista.id });
    expect(emitida.status).toBe(201);
    const token: string = emitida.body.datos.token;

    const antes = await garita.post('/api/garita/validar').send({ token, zona_id: zona.id });
    expect(antes.body.datos.resultado).toBe('valido');

    const bloqueo = await seguridad
      .post('/api/bloqueos')
      .send({ tipo: 'manual', motivo: `${marca}: bloqueo para la garita`, contratista_id: contratista.id });
    expect(bloqueo.status).toBe(201);

    const bloqueada = await garita.post('/api/garita/validar').send({ token, zona_id: zona.id });
    expect(bloqueada.body.datos.resultado).toBe('bloqueado');
    expect(bloqueada.body.datos.permitido).toBe(false);

    const levantado = await seguridad.post(`/api/bloqueos/${bloqueo.body.datos.id}/levantar`).send({ motivo: 'Fin de la prueba de garita' });
    expect(levantado.status).toBe(200);

    const despues = await garita.post('/api/garita/validar').send({ token, zona_id: zona.id });
    expect(despues.body.datos.resultado).toBe('valido');

    // La credencial de prueba se revoca para no dejar nada activo
    await seguridad.post(`/api/credenciales/${emitida.body.datos.id}/revocar`).send({ motivo: 'Fin de la prueba de bloqueos' });
  });
});