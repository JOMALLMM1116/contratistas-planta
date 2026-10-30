import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '../shared/db.js';
import { env } from '../shared/config/env.js';

const DESCRIPCION = 'Mantenimiento general de bodegas (flujo de demostracion)';

const hoyGuatemala = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const masDias = (iso: string, dias: number) => {
  const d = fecha(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
};
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

// PDF minimo real en disco, para que la descarga del documento funcione
async function archivoDemo(nombre: string, subidoPor: string) {
  const carpeta = path.resolve(process.cwd(), env.UPLOADS_DIR);
  mkdirSync(carpeta, { recursive: true });
  const storageKey = `${randomUUID()}.pdf`;
  const contenido = Buffer.from('%PDF-1.4\n% Documento de demostracion\n%%EOF\n', 'latin1');
  writeFileSync(path.join(carpeta, storageKey), contenido);

  return prisma.archivos.create({
    data: {
      nombre_original: nombre,
      mime_type: 'application/pdf',
      tamano_bytes: BigInt(contenido.length),
      storage_key: storageKey,
      subido_por: subidoPor,
    },
  });
}

async function main() {
  const [seguridad, responsable, usuarioContratista] = await Promise.all([
    prisma.usuarios.findUniqueOrThrow({ where: { email: 'seguridad@planta.test' } }),
    prisma.usuarios.findUniqueOrThrow({ where: { email: 'responsable@planta.test' } }),
    prisma.usuarios.findUniqueOrThrow({ where: { email: 'contratista@empresa.test' } }),
  ]);
  const contratista = await prisma.contratistas.findUniqueOrThrow({ where: { documento_identidad: '1234567890101' } });

  const hoy = hoyGuatemala();
  const vence = masDias(hoy, 365);

  // 1. Documentos obligatorios aprobados (DPI y seguro del contratista; poliza de la empresa)
  const tipos = await prisma.tipos_documento.findMany({ where: { codigo: { in: ['DPI', 'SEGURO_VIDA', 'POLIZA_RC'] } } });
  for (const tipo of tipos) {
    const dueno = tipo.aplica_a === 'empresa' ? { empresa_id: contratista.empresa_id } : { contratista_id: contratista.id };
    const vigente = await prisma.documentos.findFirst({
      where: { tipo_documento_id: tipo.id, ...dueno, estado_revision: 'aprobado', fecha_vencimiento: { gte: fecha(hoy) } },
    });
    if (vigente) continue;

    const archivo = await archivoDemo(`${tipo.codigo}-demo.pdf`, usuarioContratista.id);
    await prisma.documentos.create({
      data: {
        tipo_documento_id: tipo.id,
        ...dueno,
        archivo_id: archivo.id,
        numero: `DEMO-${tipo.codigo}`,
        fecha_emision: fecha(hoy),
        fecha_vencimiento: vence,
        estado_revision: 'aprobado',
        revisado_por: seguridad.id,
        revisado_en: new Date(),
        subido_por: usuarioContratista.id,
      },
    });
    console.log(`  ✔ documento ${tipo.codigo} aprobado`);
  }

  // 2. Induccion de seguridad aprobada
  const induccion = await prisma.capacitaciones.findUniqueOrThrow({ where: { codigo: 'INDUCCION_SSO' } });
  const capacitacion = await prisma.contratista_capacitaciones.findFirst({
    where: {
      contratista_id: contratista.id,
      capacitacion_id: induccion.id,
      estado_revision: 'aprobado',
      OR: [{ fecha_vencimiento: null }, { fecha_vencimiento: { gte: fecha(hoy) } }],
    },
  });
  if (!capacitacion) {
    await prisma.contratista_capacitaciones.create({
      data: {
        contratista_id: contratista.id,
        capacitacion_id: induccion.id,
        fecha_realizacion: fecha(hoy),
        fecha_vencimiento: vence,
        estado_revision: 'aprobado',
        revisado_por: seguridad.id,
        revisado_en: new Date(),
      },
    });
    console.log('  ✔ capacitacion INDUCCION_SSO aprobada');
  }

  // 3. Solicitud aprobada por 7 dias, todo el dia, en administracion y bodegas
  let solicitud = await prisma.solicitudes_acceso.findFirst({
    where: { descripcion_actividad: DESCRIPCION, estado: 'aprobada', fecha_fin: { gte: fecha(hoy) } },
  });
  if (!solicitud) {
    const tipo = await prisma.tipos_trabajo.findUniqueOrThrow({ where: { codigo: 'MANT_GENERAL' } });
    const zonas = await prisma.zonas.findMany({ where: { codigo: { in: ['Z-ADM', 'Z-BOD'] } } });

    solicitud = await prisma.solicitudes_acceso.create({
      data: {
        empresa_id: contratista.empresa_id,
        tipo_trabajo_id: tipo.id,
        responsable_interno_id: responsable.id,
        solicitada_por: responsable.id,
        descripcion_actividad: DESCRIPCION,
        fecha_inicio: fecha(hoy),
        fecha_fin: masDias(hoy, 7),
        hora_inicio: hora('00:00'),
        hora_fin: hora('23:59'),
        estado: 'aprobada',
        solicitud_contratistas: { create: [{ contratista_id: contratista.id }] },
        solicitud_zonas: { create: zonas.map((z) => ({ zona_id: z.id })) },
        autorizaciones: {
          create: [{ etapa: 1, decision: 'aprobada', usuario_id: responsable.id, comentario: 'Aprobada (datos de demostracion)' }],
        },
      },
    });
    console.log(`  ✔ solicitud ${solicitud.codigo} aprobada`);
  }

  console.log('\nFlujo de demostracion listo:');
  console.log(`  solicitud_id   = ${solicitud.id}`);
  console.log(`  contratista_id = ${contratista.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
