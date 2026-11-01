import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from '../src/shared/db.js';

// Requieren las migraciones aplicadas y los seeds: npm run db:seed y npm run db:seed:flujo
const app = crearApp();
const PASSWORD = process.env.DEMO_PASSWORD ?? '';
const marca = `Prueba automatica ${Date.now()}`;
const DIA = 86_400_000;

async function sesion(email: string) {
  const agente = request.agent(app);
  const respuesta = await agente.post('/api/auth/login').send({ email, password: PASSWORD });
  expect(respuesta.status, `login de ${email}`).toBe(200);
  return agente;
}

// Fecha como medianoche UTC, igual que las columnas DATE
const fecha = (dias: number) => new Date(new Date(new Date().toISOString().slice(0, 10)).getTime() + dias * DIA);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('estado vencido en la revision diaria', () => {
  let admin: Awaited<ReturnType<typeof sesion>>;
  let seguridad: Awaited<ReturnType<typeof sesion>>;
  let base: { empresa_id: string; tipo_trabajo_id: number; responsable_interno_id: string; solicitada_por: string };
  let contratistaId: string;
  let solicitudVencidaId: string;
  let solicitudVigenteId: string;
  let permisoEnEjecucionId: string;
  let credencialVencidaId: string;
  let credencialVigenteId: string;

  async function nuevaSolicitud(descripcion: string, inicio: number, fin: number) {
    return prisma.solicitudes_acceso.create({
      data: {
        ...base,
        descripcion_actividad: `${marca}: ${descripcion}`,
        fecha_inicio: fecha(inicio),
        fecha_fin: fecha(fin),
        hora_inicio: new Date('1970-01-01T08:00:00.000Z'),
        hora_fin: new Date('1970-01-01T17:00:00.000Z'),
        estado: 'aprobada',
      },
    });
  }

  beforeAll(async () => {
    admin = await sesion('admin@planta.test');
    seguridad = await sesion('seguridad@planta.test');

    const origen = await prisma.solicitudes_acceso.findFirstOrThrow({
      where: { descripcion_actividad: { contains: 'flujo de demostracion' }, estado: 'aprobada' },
    });
    base = {
      empresa_id: origen.empresa_id,
      tipo_trabajo_id: origen.tipo_trabajo_id,
      responsable_interno_id: origen.responsable_interno_id,
      solicitada_por: origen.solicitada_por,
    };
    const contratista = await prisma.contratistas.findUniqueOrThrow({ where: { documento_identidad: '1234567890101' } });
    contratistaId = contratista.id;

    // Solicitudes: una vencida (fin hace 2 dias) y una vigente (fin en 3 dias)
    solicitudVencidaId = (await nuevaSolicitud('solicitud vencida', -5, -2)).id;
    solicitudVigenteId = (await nuevaSolicitud('solicitud vigente', 0, 3)).id;

    // Permiso en ejecucion con fecha pasada: la revision no debe tocarlo
    const solicitudPermiso = await nuevaSolicitud('permiso en ejecucion', -5, -2);
    const aprobador = await prisma.usuarios.findUniqueOrThrow({ where: { email: 'seguridad@planta.test' }, select: { id: true } });
    const permiso = await prisma.permisos_trabajo.create({
      data: {
        solicitud_id: solicitudPermiso.id,
        fecha_inicio: fecha(-5),
        fecha_fin: fecha(-2),
        hora_inicio: new Date('1970-01-01T08:00:00.000Z'),
        hora_fin: new Date('1970-01-01T17:00:00.000Z'),
        estado: 'en_ejecucion',
        aprobado_por: aprobador.id,
        actividad_inicio_en: new Date(Date.now() - 3 * DIA),
        actividad_inicio_por: aprobador.id,
      },
    });
    permisoEnEjecucionId = permiso.id;

    // Credenciales: se emiten por la API y luego se ajustan sus fechas (la base exige expira_en > emitida_en)
    const solicitudCredencial = await prisma.solicitudes_acceso.findFirstOrThrow({
      where: { descripcion_actividad: { contains: 'flujo de demostracion' }, estado: 'aprobada' },
    });
    const activas = await prisma.credenciales.findMany({
      where: { solicitud_id: solicitudCredencial.id, contratista_id: contratistaId, estado: 'activa' },
    });
    for (const c of activas) {
      await seguridad.post(`/api/credenciales/${c.id}/revocar`).send({ motivo: 'Limpieza antes de la prueba de vencimientos' });
    }

    const vencida = await seguridad.post('/api/credenciales').send({ solicitud_id: solicitudCredencial.id, contratista_id: contratistaId });
    expect(vencida.status).toBe(201);
    credencialVencidaId = vencida.body.datos.id;
    await prisma.credenciales.update({
      where: { id: credencialVencidaId },
      data: { emitida_en: new Date(Date.now() - 3 * DIA), expira_en: new Date(Date.now() - DIA) },
    });

    // La vigente tambien tiene que ser unica activa: se emite despues de dejar vencida la anterior
    // (la anterior sigue "activa" hasta la revision, asi que se verifica la vigente en otra solicitud)
    const otraSolicitud = await nuevaSolicitud('credencial vigente', 0, 3);
    const vigente = await seguridad.post('/api/credenciales').send({ solicitud_id: otraSolicitud.id, contratista_id: contratistaId });
    if (vigente.status === 201) credencialVigenteId = vigente.body.datos.id;
  });

  it('solo admin puede ejecutar la revision a mano', async () => {
    expect((await seguridad.post('/api/notificaciones/revision')).status).toBe(403);
    expect((await request(app).post('/api/notificaciones/revision')).status).toBe(401);
  });

  it('marca como vencida la solicitud aprobada cuya fecha_fin ya paso, con historial', async () => {
    const r = await admin.post('/api/notificaciones/revision');
    expect(r.status).toBe(200);
    expect(r.body.datos.solicitudes_vencidas).toBeGreaterThanOrEqual(1);

    const vencida = await prisma.solicitudes_acceso.findUniqueOrThrow({ where: { id: solicitudVencidaId } });
    expect(vencida.estado).toBe('vencida');

    const historial = await prisma.historial_estados.findMany({ where: { entidad: 'solicitud', entidad_id: solicitudVencidaId } });
    expect(historial).toHaveLength(1);
    expect(historial[0]!.estado_anterior).toBe('aprobada');
    expect(historial[0]!.estado_nuevo).toBe('vencida');
    expect(historial[0]!.motivo).toBe('Vencimiento automatico');
    expect(historial[0]!.usuario_id).toBeNull();
  });

  it('no toca una solicitud vigente', async () => {
    const vigente = await prisma.solicitudes_acceso.findUniqueOrThrow({ where: { id: solicitudVigenteId } });
    expect(vigente.estado).toBe('aprobada');
  });

  it('marca como vencida la credencial activa cuyo expira_en ya paso, con historial', async () => {
    const vencida = await prisma.credenciales.findUniqueOrThrow({ where: { id: credencialVencidaId } });
    expect(vencida.estado).toBe('vencida');

    const historial = await prisma.historial_estados.findMany({ where: { entidad: 'credencial', entidad_id: credencialVencidaId } });
    expect(historial.some((h) => h.estado_anterior === 'activa' && h.estado_nuevo === 'vencida' && h.motivo === 'Vencimiento automatico')).toBe(true);
  });

  it('no toca una credencial vigente', async () => {
    if (!credencialVigenteId) return;
    const vigente = await prisma.credenciales.findUniqueOrThrow({ where: { id: credencialVigenteId } });
    expect(vigente.estado).toBe('activa');
  });

  it('no marca como vencido un permiso en ejecucion', async () => {
    const permiso = await prisma.permisos_trabajo.findUniqueOrThrow({ where: { id: permisoEnEjecucionId } });
    expect(permiso.estado).toBe('en_ejecucion');
  });

  it('una segunda revision no cambia nada (idempotente)', async () => {
    const r = await admin.post('/api/notificaciones/revision');
    expect(r.status).toBe(200);
    expect(r.body.datos.solicitudes_vencidas).toBe(0);
    expect(r.body.datos.credenciales_vencidas).toBe(0);
  });
});