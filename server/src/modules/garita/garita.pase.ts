import type { Request } from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { firmarTokenCredencial } from '../credenciales/credenciales.token.js';

type Documento = InstanceType<typeof PDFDocument>;

const fechaGuatemala = (d: Date) =>
  d.toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' });

// Junta en memoria las partes del PDF que va generando PDFKit
function aBuffer(doc: Documento) {
  return new Promise<Buffer>((resolve, reject) => {
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });
}

function linea(doc: Documento, etiqueta: string, valor: string) {
  doc.font('Helvetica-Bold').fontSize(9).text(`${etiqueta}: `, { continued: true }).font('Helvetica').text(valor);
}

// Pase temporal tamano A6: QR con el mismo token de la credencial, codigo corto y datos de acceso
export async function generarPase(credencialId: string, req: Request) {
  const credencial = await prisma.credenciales.findUnique({ where: { id: credencialId } });
  if (!credencial) throw new AppError(404, 'CREDENCIAL_NO_ENCONTRADA', `No existe la credencial ${credencialId}`);

  if (credencial.estado !== 'activa' || credencial.expira_en <= new Date()) {
    throw new AppError(409, 'CREDENCIAL_NO_ACTIVA', 'Solo se imprime el pase de una credencial activa y vigente');
  }

  const [contratista, solicitud, vinculos] = await Promise.all([
    prisma.contratistas.findUniqueOrThrow({ where: { id: credencial.contratista_id } }),
    prisma.solicitudes_acceso.findUniqueOrThrow({ where: { id: credencial.solicitud_id } }),
    prisma.solicitud_zonas.findMany({ where: { solicitud_id: credencial.solicitud_id }, select: { zona_id: true } }),
  ]);
  const [empresa, zonas] = await Promise.all([
    prisma.empresas_contratistas.findUniqueOrThrow({ where: { id: contratista.empresa_id } }),
    prisma.zonas.findMany({ where: { id: { in: vinculos.map((v) => v.zona_id) } }, orderBy: { codigo: 'asc' } }),
  ]);

  const token = await firmarTokenCredencial(credencial);
  const qr = await QRCode.toBuffer(token, { errorCorrectionLevel: 'M', margin: 1, width: 400 });

  const doc = new PDFDocument({ size: 'A6', margin: 24, info: { Title: `Pase temporal ${credencial.codigo_corto}` } });
  const terminado = aBuffer(doc);

  doc.font('Helvetica-Bold').fontSize(13).text('PASE TEMPORAL DE ACCESO', { align: 'center' });
  doc.font('Helvetica').fontSize(8).text('Plataforma de Contratistas y Acceso a Planta', { align: 'center' });
  doc.moveDown(0.6);

  // QR centrado; al darle posicion fija, PDFKit no mueve el cursor y se ajusta a mano
  const ancho = 150;
  const y = doc.y;
  doc.image(qr, (doc.page.width - ancho) / 2, y, { width: ancho });
  doc.y = y + ancho + 6;

  doc.font('Helvetica-Bold').fontSize(18).text(credencial.codigo_corto, { align: 'center', characterSpacing: 2 });
  doc.moveDown(0.5);

  linea(doc, 'Nombre', `${contratista.nombres} ${contratista.apellidos}`);
  linea(doc, 'DPI', contratista.documento_identidad);
  linea(doc, 'Empresa', empresa.razon_social);
  linea(doc, 'Solicitud', `${solicitud.codigo} - ${solicitud.descripcion_actividad}`);
  linea(doc, 'Zonas', zonas.map((z) => `${z.codigo} ${z.nombre}`).join(', '));
  linea(doc, 'Válido hasta', fechaGuatemala(credencial.expira_en));
  linea(
    doc,
    'Usos',
    credencial.usos_maximos ? `${credencial.usos_actuales} de ${credencial.usos_maximos}` : 'Ilimitados durante la vigencia',
  );

  doc.moveDown(0.8);
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#555555')
    .text(`Impreso por ${req.usuario!.email} el ${fechaGuatemala(new Date())}\nPortar visible y devolver al salir`, {
      align: 'center',
    });

  doc.end();
  const pdf = await terminado;

  await prisma.pases_impresos.create({ data: { credencial_id: credencial.id, impreso_por: req.usuario!.id } });
  await registrarAuditoria(req, {
    accion: 'IMPRIMIR_PASE',
    entidad: 'credenciales',
    entidad_id: credencial.id,
    datos_despues: { codigo_corto: credencial.codigo_corto },
  });

  return { pdf, nombreArchivo: `pase-${credencial.codigo_corto}.pdf` };
}
