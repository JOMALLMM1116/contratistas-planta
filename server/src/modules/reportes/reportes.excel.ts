import ExcelJS from 'exceljs';
import type { Reporte } from './reportes.tipos.js';

export async function generarExcel(reporte: Reporte) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Contratistas Planta';
  libro.created = new Date();

  const hoja = libro.addWorksheet(reporte.nombre);
  reporte.columnas.forEach((c, i) => {
    hoja.getColumn(i + 1).width = c.ancho;
  });

  hoja.addRow([reporte.titulo]).font = { bold: true, size: 14 };
  for (const linea of reporte.subtitulo) {
    hoja.addRow([linea]).font = { italic: true, color: { argb: 'FF555555' } };
  }
  hoja.addRow([]);

  const encabezado = hoja.addRow(reporte.columnas.map((c) => c.titulo));
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  });

  for (const fila of reporte.filas) {
    hoja.addRow(reporte.columnas.map((c) => fila[c.clave] ?? ''));
  }

  // Encabezado fijo y filtros en las columnas
  hoja.views = [{ state: 'frozen', ySplit: encabezado.number }];
  hoja.autoFilter = {
    from: { row: encabezado.number, column: 1 },
    to: { row: encabezado.number, column: reporte.columnas.length },
  };

  const datos = await libro.xlsx.writeBuffer();
  return Buffer.from(datos as ArrayBuffer);
}