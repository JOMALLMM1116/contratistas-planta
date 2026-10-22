import type { Request, Response } from 'express';
import { generarExcel } from './reportes.excel.js';
import { generarPdf } from './reportes.pdf.js';
import * as reportesService from './reportes.service.js';
import { dashboardSchema, filtrosReporteSchema, tipoReporteSchema } from './reportes.schemas.js';

const TIPO_EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function dashboard(req: Request, res: Response) {
  const { dias } = dashboardSchema.parse(req.query);
  res.json({ datos: await reportesService.dashboard(dias) });
}

export async function reporte(req: Request, res: Response) {
  const { tipo } = tipoReporteSchema.parse(req.params);
  const filtros = filtrosReporteSchema.parse(req.query);
  const resultado = await reportesService.generar(tipo, filtros);

  if (filtros.formato === 'json') {
    res.json({
      datos: {
        titulo: resultado.titulo,
        subtitulo: resultado.subtitulo,
        columnas: resultado.columnas,
        filas: resultado.filas,
      },
      total: resultado.filas.length,
    });
    return;
  }

  const archivo = `reporte-${resultado.nombre}-${new Date().toISOString().slice(0, 10)}`;
  res.setHeader('Cache-Control', 'no-store');

  if (filtros.formato === 'excel') {
    const contenido = await generarExcel(resultado);
    res.setHeader('Content-Type', TIPO_EXCEL);
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}.xlsx"`);
    res.send(contenido);
    return;
  }

  const contenido = await generarPdf(resultado);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${archivo}.pdf"`);
  res.send(contenido);
}