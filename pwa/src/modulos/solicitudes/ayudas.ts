/** Las horas llegan como "HH:MM"; por si llegaran como fecha ISO, se toma solo la hora */
export function hora(valor: string): string {
  return /^\d{2}:\d{2}/.test(valor) ? valor.slice(0, 5) : valor.slice(11, 16)
}

const TIPO_REQUISITO: Record<string, string> = {
  documento: 'Documento',
  capacitacion: 'Capacitación',
}

/** Si el backend manda un tipo desconocido, se muestra tal cual */
export const textoTipoRequisito = (tipo: string) => TIPO_REQUISITO[tipo] ?? tipo