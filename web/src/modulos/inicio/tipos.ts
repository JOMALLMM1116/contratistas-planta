export interface ConteoVencimientos {
  por_vencer: number
  vencidos: number
}

/** Respuesta de GET /reportes/dashboard (campo "datos") */
export interface Dashboard {
  /** "2026-11-03 01:23" */
  generado_en: string
  por_vencer_dias: number
  vencidos_ultimos_dias: number
  solicitudes: { total: number; por_estado: Record<string, number> }
  permisos: { total: number; por_estado: Record<string, number>; vigentes_hoy: number }
  vencimientos: { documentos: ConteoVencimientos; capacitaciones: ConteoVencimientos }
  totales: { empresas_activas: number; contratistas_activos: number; equipos_activos: number }
  empresas_top: { id: string; nit: string; razon_social: string; contratistas: number; equipos: number }[]
}