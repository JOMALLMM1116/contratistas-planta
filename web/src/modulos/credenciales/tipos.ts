// Forma de los datos según las respuestas reales de /api/credenciales

export interface Credencial {
  id: string
  solicitud_id: string
  contratista_id: string
  permiso_trabajo_id: string | null
  codigo_corto: string
  emitida_en: string
  expira_en: string
  /** Estado guardado en la base */
  estado: string
  usos_maximos: number | null
  usos_actuales: number
  usada_en: string | null
  emitida_por: string
  revocada_en: string | null
  revocada_por: string | null
  motivo_revocacion: string | null
  /** Estado calculado por el backend (por ejemplo, una "activa" ya vencida sale como "vencida"). Es el que se muestra */
  estado_efectivo: string
}

/** Respuesta de emitir y de GET /credenciales/:id/qr */
export interface CredencialConQr extends Credencial {
  /** JWT firmado que va dentro del QR. No se muestra en texto */
  token: string
  /** Imagen del QR: "data:image/png;base64,..." */
  qr: string
}

/** "0 (ilimitado)" o "1 de 1" */
export function textoUsos(c: Pick<Credencial, 'usos_actuales' | 'usos_maximos'>): string {
  return c.usos_maximos === null ? `${c.usos_actuales} (ilimitado)` : `${c.usos_actuales} de ${c.usos_maximos}`
}
