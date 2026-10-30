import PDFDocument from 'pdfkit';
import type { Reporte } from './reportes.tipos.js';

const MARGEN = 36;
const ALTO_FILA = 18;
const COLOR_TITULO = '#1F4E78';

export function generarPdf(reporte: Reporte): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: MARGEN, bufferPages: true });
    doc.info.Title = reporte.titulo;

    const trozos: Buffer[] = [];
    doc.on('data', (trozo: Buffer) => trozos.push(trozo));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    // Cada columna ocupa una parte del ancho segun su "ancho" relativo
    const anchoUtil = doc.page.width - MARGEN * 2;
    const suma = reporte.columnas.reduce((total, c) => total + c.ancho, 0);
    const anchos = reporte.columnas.map((c) => (c.ancho / suma) * anchoUtil);

    const dibujarEncabezado = (y: number) => {
      doc.rect(MARGEN, y, anchoUtil, ALTO_FILA).fill(COLOR_TITULO);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      let x = MARGEN;
      reporte.columnas.forEach((c, i) => {
        const ancho = anchos[i] ?? 0;
        doc.text(c.titulo, x + 3, y + 5, { width: ancho - 6, height: ALTO_FILA - 6, ellipsis: true });
        x += ancho;
      });
      return y + ALTO_FILA;
    };

    doc.font('Helvetica-Bold').fontSize(16).fillColor(COLOR_TITULO).text(reporte.titulo, MARGEN, MARGEN);
    doc.font('Helvetica').fontSize(9).fillColor('#555555');
    for (const linea of reporte.subtitulo) doc.text(linea);
    doc.moveDown(0.5);

    let y = dibujarEncabezado(doc.y);

    reporte.filas.forEach((fila, indice) => {
      if (y + ALTO_FILA > doc.page.height - MARGEN) {
        doc.addPage();
        y = dibujarEncabezado(MARGEN);
      }
      if (indice % 2 === 1) doc.rect(MARGEN, y, anchoUtil, ALTO_FILA).fill('#EEF3F8');
      doc.fillColor('#000000').font('Helvetica').fontSize(8);
      let x = MARGEN;
      reporte.columnas.forEach((c, i) => {
        const ancho = anchos[i] ?? 0;
        doc.text(String(fila[c.clave] ?? ''), x + 3, y + 5, { width: ancho - 6, height: ALTO_FILA - 6, ellipsis: true });
        x += ancho;
      });
      y += ALTO_FILA;
    });

    if (reporte.filas.length === 0) {
      doc.fillColor('#555555').font('Helvetica-Oblique').fontSize(9);
      doc.text('Sin resultados para los filtros indicados.', MARGEN, y + 8);
    }

    // Numero de pagina en todas las hojas
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor('#777777');
      doc.text(`Pagina ${i + 1} de ${paginas.count}`, MARGEN, doc.page.height - 24, {
        width: anchoUtil,
        align: 'right',
        lineBreak: false,
      });
    }

    doc.end();
  });
}