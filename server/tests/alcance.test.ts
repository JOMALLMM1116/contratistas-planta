import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { prisma } from '../src/shared/db.js';

// SEG-01: autorizacion por objeto. Un usuario externo (contratista o supervisor de campo)
// solo ve y opera sobre lo de su empresa o lo suyo; el personal interno ve todo.
// Requieren las migraciones aplicadas y los seeds: npm run db:seed y npm run db:seed:flujo
const app = crearApp();
const PASSWORD = process.env.DEMO_PASSWORD ?? '';
const sello = Date.now().toString();

async function sesion(email: string) {
  const agente = request.agent(app);
  const respuesta = await agente.post('/api/auth/login').send({ email, password: PASSWORD });
  expect(respuesta.status, `login de ${email}`).toBe(200);
  return agente;
}

// Datos de "otra empresa" creados solo para estas pruebas
let empresaB: string;
let contratistaB: string;
let solicitudB: string;
let archivoAjeno: string;
// Datos de la demo
let contratistaDemo: string;
let tipoTrabajoId: number;
let tipoDpiId: number;
let adminId: string;

beforeAll(async () => {
  const admin = await prisma.usuarios.findUniqueOrThrow({ where: { email: 'admin@planta.test' }, select: { id: true } });
  adminId = admin.id;
  contratistaDemo = (await prisma.contratistas.findUniqueOrThrow({ where: { documento_identidad: '1234567890101' } })).id;
  tipoTrabajoId = (await prisma.tipos_trabajo.findUniqueOrThrow({ where: { codigo: 'MANT_GENERAL' } })).id;
  tipoDpiId = (await prisma.tipos_documento.findUniqueOrThrow({ where: { codigo: 'DPI' } })).id;

  const empresa = await prisma.empresas_contratistas.create({
    data: { nit: `9${sello.slice(-6)}-1`, razon_social: `Empresa B prueba de alcance ${sello}` },
  });
  empresaB = empresa.id;

  const contratista = await prisma.contratistas.create({
    data: { empresa_id: empresaB, nombres: 'Contratista', apellidos: `B ${sello}`, documento_identidad: `ALC${sello}` },
  });
  contratistaB = contratista.id;

  const solicitud = await prisma.solicitudes_acceso.create({
    data: {
      empresa_id: empresaB,
      tipo_trabajo_id: tipoTrabajoId,
      responsable_interno_id: adminId,
      solicitada_por: adminId,
      descripcion_actividad: `Solicitud de la empresa B ${sello}`,
      fecha_inicio: new Date('2030-01-01'),
      fecha_fin: new Date('2030-01-02'),
      hora_inicio: new Date('1970-01-01T08:00:00.000Z'),
      hora_fin: new Date('1970-01-01T17:00:00.000Z'),
      solicitud_contratistas: { create: [{ contratista_id: contratistaB }] },
    },
  });
  solicitudB = solicitud.id;

  // Un archivo que subio otra persona (admin) y que no esta vinculado a nada del contratista demo
  const archivo = await prisma.archivos.create({
    data: {
      nombre_original: `ajeno-${sello}.pdf`,
      mime_type: 'application/pdf',
      tamano_bytes: BigInt(10),
      storage_key: `alcance-${sello}.pdf`,
      subido_por: adminId,
    },
  });
  archivoAjeno = archivo.id;
});

afterAll(async () => {
  // Limpieza: cada paso por separado para que un fallo no impida los demas
  const pasos = [
    () => prisma.solicitud_contratistas.deleteMany({ where: { solicitud_id: solicitudB } }),
    () => prisma.solicitudes_acceso.deleteMany({ where: { id: solicitudB } }),
    () => prisma.contratistas.deleteMany({ where: { id: contratistaB } }),
    () => prisma.empresas_contratistas.deleteMany({ where: { id: empresaB } }),
    () => prisma.archivos.deleteMany({ where: { id: archivoAjeno } }),
  ];
  for (const paso of pasos) {
    try {
      await paso();
    } catch {
      // Si algo queda por una FK, no debe hacer fallar la suite
    }
  }
  await prisma.$disconnect();
});

describe('alcance del contratista (externo)', () => {
  it('no ve contratistas, empresas ni solicitudes de otra empresa', async () => {
    const contratista = await sesion('contratista@empresa.test');

    const contratistas = await contratista.get('/api/contratistas?por_pagina=100');
    expect(contratistas.status).toBe(200);
    // Solo su propia ficha
    expect(contratistas.body.datos.map((c: { id: string }) => c.id)).toEqual([contratistaDemo]);

    const solicitudes = await contratista.get('/api/solicitudes?por_pagina=100');
    expect(solicitudes.body.datos.some((s: { id: string }) => s.id === solicitudB)).toBe(false);

    const empresas = await contratista.get('/api/empresas-contratistas?por_pagina=100');
    expect(empresas.body.datos.some((e: { id: string }) => e.id === empresaB)).toBe(false);
  });

  it('pedir por id lo de otra empresa responde 404 (no revela que existe)', async () => {
    const contratista = await sesion('contratista@empresa.test');

    expect((await contratista.get(`/api/contratistas/${contratistaB}`)).status).toBe(404);
    expect((await contratista.get(`/api/empresas-contratistas/${empresaB}`)).status).toBe(404);
    expect((await contratista.get(`/api/solicitudes/${solicitudB}`)).status).toBe(404);
    expect((await contratista.get(`/api/solicitudes/${solicitudB}/requisitos`)).status).toBe(404);
    expect((await contratista.get(`/api/archivos/${archivoAjeno}`)).status).toBe(404);
    expect((await contratista.get(`/api/archivos/${archivoAjeno}/descargar`)).status).toBe(404);
  });

  it('no registra documentos a nombre de otro ni con archivos ajenos', async () => {
    const contratista = await sesion('contratista@empresa.test');
    const base = { tipo_documento_id: tipoDpiId, fecha_vencimiento: '2030-12-31' };

    // Dueno fuera de su alcance: 403
    const ajeno = await contratista.post('/api/documentos').send({ ...base, contratista_id: contratistaB, archivo_id: archivoAjeno });
    expect(ajeno.status).toBe(403);

    // Dueno correcto (el mismo) pero con un archivo que no puede ver: 404
    const archivo = await contratista.post('/api/documentos').send({ ...base, contratista_id: contratistaDemo, archivo_id: archivoAjeno });
    expect(archivo.status).toBe(404);
    expect(archivo.body.error.code).toBe('ARCHIVO_NO_ENCONTRADO');
  });
});

describe('alcance del supervisor de campo (externo)', () => {
  it('no ve ni opera solicitudes de otra empresa', async () => {
    const supervisor = await sesion('supervisor@empresa.test');

    const lista = await supervisor.get('/api/solicitudes?por_pagina=100');
    expect(lista.status).toBe(200);
    expect(lista.body.datos.some((s: { id: string }) => s.id === solicitudB)).toBe(false);

    expect((await supervisor.get(`/api/solicitudes/${solicitudB}`)).status).toBe(404);
    expect((await supervisor.post(`/api/solicitudes/${solicitudB}/cancelar`).send({ motivo: 'Intento ajeno' })).status).toBe(404);
    expect((await supervisor.get(`/api/contratistas/${contratistaB}`)).status).toBe(404);
  });

  it('no crea solicitudes a nombre de otra empresa', async () => {
    const supervisor = await sesion('supervisor@empresa.test');

    const r = await supervisor.post('/api/solicitudes').send({
      empresa_id: empresaB,
      tipo_trabajo_id: tipoTrabajoId,
      responsable_interno_id: adminId,
      descripcion_actividad: 'Intento de crear para otra empresa',
      fecha_inicio: '2030-01-01',
      fecha_fin: '2030-01-02',
      hora_inicio: '08:00',
      hora_fin: '17:00',
    });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('SIN_PERMISO');
  });
});

describe('personal interno', () => {
  it('el admin si ve lo de cualquier empresa', async () => {
    const admin = await sesion('admin@planta.test');

    expect((await admin.get(`/api/contratistas/${contratistaB}`)).status).toBe(200);
    expect((await admin.get(`/api/empresas-contratistas/${empresaB}`)).status).toBe(200);
    expect((await admin.get(`/api/solicitudes/${solicitudB}`)).status).toBe(200);
    expect((await admin.get(`/api/archivos/${archivoAjeno}`)).status).toBe(200);
  });
});
