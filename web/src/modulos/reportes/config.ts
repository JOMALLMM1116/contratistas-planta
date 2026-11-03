import { infoEstado } from '../../utilidades/estados'
import type { TipoReporte } from './tipos'

interface ConfigReporte {
  texto: string
  /** Estados que se pueden filtrar (vacío = el reporte no filtra por estado) */
  estados: { valor: string; texto: string }[]
  /** Filtra por rango de fechas */
  fechas: boolean
  /** Filtra por días hacia adelante (solo vencimientos) */
  dias: boolean
}

const estadosDe = (entidad: 'solicitud' | 'permiso_trabajo', lista: string[]) =>
  lista.map((valor) => ({ valor, texto: infoEstado(entidad, valor).texto }))

export const CONFIG: Record<TipoReporte, ConfigReporte> = {
  solicitudes: {
    texto: 'Solicitudes de acceso',
    estados: estadosDe('solicitud', ['borrador', 'pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada', 'vencida', 'revocada']),
    fechas: true,
    dias: false,
  },
  permisos: {
    texto: 'Permisos de trabajo',
    estados: estadosDe('permiso_trabajo', ['emitido', 'en_ejecucion', 'cerrado', 'revocado', 'vencido']),
    fechas: true,
    dias: false,
  },
  vencimientos: { texto: 'Vencimientos de documentos y capacitaciones', estados: [], fechas: false, dias: true },
  contratistas: {
    texto: 'Contratistas',
    estados: [
      { valor: 'activo', texto: 'Activos' },
      { valor: 'inactivo', texto: 'Inactivos' },
    ],
    fechas: false,
    dias: false,
  },
}

export const TIPOS = Object.keys(CONFIG) as TipoReporte[]