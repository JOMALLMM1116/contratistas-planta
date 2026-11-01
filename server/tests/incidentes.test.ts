import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from '../src/shared/db.js';

// Requieren las migraciones aplicadas y el seed: npm run db:seed
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
  // El historial de estados es de solo insercion y apunta al incidente: solo se borran los abiertos sin historial
  const abiertos = await prisma.incidentes.findMany({ where: { descripcion: { startsWith: marca }, estado: 'abierto' }, select: { id: true } });
  for (const { id } of abiertos) {
    if ((await prisma.historial_estados.count({ where: { entidad_id: id } })) === 0) {
      await prisma.incidentes.delete({ where: { id } });
    }
  }
  await prisma.$disconnect();
});

describe('incidentes', () => {
  let seguridad: Awaited<ReturnType<typeof sesion>>;
  let supervisor: Awaited<ReturnType<typeof sesion>>;
  let empresaId: string;
  let contratistaId: string;
  let archivoId: string;
  let incidenteId: string;
  let reportadoPorId: string;

  beforeAll(async () => {
    seguridad = await sesion('seguridad@planta.test');
    supervisor = await sesion('supervisor@empresa.test');

    const contratista = await prisma.contratistas.findFirstOrThrow({ select: { id: true, empresa_id: true } });
    contratistaId = contratista.id;
    empresaId = contratista.empresa_id;

    const subido = await supervisor
      .post('/api/archivos')
      .attach('archivo', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF'), { filename: 'evidencia.pdf', contentType: 'application/pdf' });
    expect(subido.status).toBe(201);
    archivoId = subido.body.datos.id;
  });

  it('crea un incidente: reportado_por sale de la sesion y no del cuerpo', async () => {
    const otro = await prisma.usuarios.findUniqueOrThrow({ where: { email: 'admin@planta.test' }, select: { id: true } });
    const r = await supervisor.post('/api/incidentes').send({
      contratista_id: contratistaId,
      severidad: 'moderado',
      descripcion: `${marca}: caida de herramienta`,
      reportado_por: otro.id,
    });
    expect(r.status).toBe(201);
    expect(r.body.datos.estado).toBe('abierto');
    expect(r.body.datos.codigo).toMatch(/^INC-/);
    expect(r.body.datos.reportado_por_usuario.email).toBe('supervisor@empresa.test');
    expect(r.body.datos.reportado_por).not.toBe(otro.id);
    incidenteId = r.body.datos.id;
    reportadoPorId = r.body.datos.reportado_por;
  });

  it('exige contratista, empresa o solicitud', async () => {
    const r = await supervisor.post('/api/incidentes').send({ severidad: 'leve', descripcion: `${marca}: sin vinculo` });
    expect(r.status).toBe(400);
  });

  it('exige permisos: garita puede reportar pero no consultar', async () => {
    const garita = await sesion('garita@planta.test');
    expect((await garita.get('/api/incidentes')).status).toBe(403);
    expect((await garita.post(`/api/incidentes/${incidenteId}/cerrar`).send({})).status).toBe(403);
    expect((await request(app).get('/api/incidentes')).status).toBe(401);
  });

  it('el supervisor puede reportar pero no gestionar', async () => {
    expect((await supervisor.get('/api/incidentes')).status).toBe(403);
    expect((await supervisor.post(`/api/incidentes/${incidenteId}/investigar`).send({})).status).toBe(403);
  });

  it('filtra por estado, severidad, contratista, empresa y fechas', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const base = `/api/incidentes?estado=abierto&severidad=moderado&contratista_id=${contratistaId}&desde=${hoy}&hasta=${hoy}`;
    const r = await seguridad.get(base);
    expect(r.status).toBe(200);
    expect(r.body.datos.some((i: { id: string }) => i.id === incidenteId)).toBe(true);

    const porEmpresa = await seguridad.get(`/api/incidentes?empresa_id=${empresaId}`);
    expect(porEmpresa.body.datos.some((i: { id: string }) => i.id === incidenteId)).toBe(true);

    const otraSeveridad = await seguridad.get(`/api/incidentes?severidad=critico&contratista_id=${contratistaId}&desde=${hoy}&hasta=${hoy}`);
    expect(otraSeveridad.body.datos.some((i: { id: string }) => i.id === incidenteId)).toBe(false);

    expect((await seguridad.get('/api/incidentes?estado=otro')).status).toBe(400);
  });

  it('actualiza los datos del incidente', async () => {
    const r = await seguridad.patch(`/api/incidentes/${incidenteId}`).send({ severidad: 'grave', acciones_correctivas: 'Delimitar la zona' });
    expect(r.status).toBe(200);
    expect(r.body.datos.severidad).toBe('grave');
    expect(r.body.datos.acciones_correctivas).toBe('Delimitar la zona');
  });

  it('vincula y quita evidencias con archivos ya subidos', async () => {
    const r = await seguridad.post(`/api/incidentes/${incidenteId}/evidencias`).send({ archivo_id: archivoId });
    expect(r.status).toBe(201);
    expect(r.body.datos.evidencias).toHaveLength(1);
    expect(r.body.datos.evidencias[0].nombre_original).toBe('evidencia.pdf');

    expect((await seguridad.post(`/api/incidentes/${incidenteId}/evidencias`).send({ archivo_id: archivoId })).status).toBe(409);
    expect((await seguridad.post(`/api/incidentes/${incidenteId}/evidencias`).send({ archivo_id: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);

    const quitada = await seguridad.delete(`/api/incidentes/${incidenteId}/evidencias/${archivoId}`);
    expect(quitada.status).toBe(200);
    expect(quitada.body.datos.evidencias).toHaveLength(0);
  });

  it('abierto -> en_investigacion -> cerrado, sin saltarse pasos, y el trigger guarda el historial', async () => {
    const saltoDirecto = await seguridad.post(`/api/incidentes/${incidenteId}/cerrar`).send({});
    expect(saltoDirecto.status).toBe(409);

    const investigando = await seguridad.post(`/api/incidentes/${incidenteId}/investigar`).send({ motivo: 'Inicia la investigacion' });
    expect(investigando.status).toBe(200);
    expect(investigando.body.datos.estado).toBe('en_investigacion');
    expect((await seguridad.post(`/api/incidentes/${incidenteId}/investigar`).send({})).status).toBe(409);

    const cerrado = await seguridad.post(`/api/incidentes/${incidenteId}/cerrar`).send({ motivo: 'Investigacion concluida', cerrado_por: reportadoPorId });
    expect(cerrado.status).toBe(200);
    expect(cerrado.body.datos.estado).toBe('cerrado');
    expect(cerrado.body.datos.cerrado_por_usuario.email).toBe('seguridad@planta.test');
    expect(cerrado.body.datos.cerrado_en).not.toBeNull();

    const historial = await seguridad.get(`/api/auditoria/historial?entidad=incidente&entidad_id=${incidenteId}`);
    if (historial.status === 200) {
      expect(historial.body.datos.map((h: { estado_nuevo: string }) => h.estado_nuevo)).toEqual(['cerrado', 'en_investigacion']);
      expect(historial.body.datos[0].motivo).toBe('Investigacion concluida');
      expect(historial.body.datos[0].usuario.email).toBe('seguridad@planta.test');
    } else {
      const filas = await prisma.historial_estados.findMany({ where: { entidad: 'incidente', entidad_id: incidenteId }, orderBy: { id: 'asc' } });
      expect(filas.map((f) => f.estado_nuevo)).toEqual(['en_investigacion', 'cerrado']);
      expect(filas[1]!.motivo).toBe('Investigacion concluida');
      expect(filas[1]!.usuario_id).not.toBeNull();
    }
  });

  it('un incidente cerrado no se elimina; uno abierto si', async () => {
    expect((await seguridad.delete(`/api/incidentes/${incidenteId}`)).status).toBe(409);

    const nuevo = await supervisor.post('/api/incidentes').send({ empresa_id: empresaId, severidad: 'leve', descripcion: `${marca}: para eliminar` });
    expect(nuevo.status).toBe(201);
    const borrado = await seguridad.delete(`/api/incidentes/${nuevo.body.datos.id}`);
    expect(borrado.status).toBe(200);
    expect((await seguridad.get(`/api/incidentes/${nuevo.body.datos.id}`)).status).toBe(404);
  });
});