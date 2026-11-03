import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  BadgeCheck,
  Ban,
  Building2,
  ClipboardList,
  FileCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HardHat,
  LayoutDashboard,
  ScanLine,
  ScrollText,
  TriangleAlert,
  UserCog,
  Users,
} from 'lucide-react'

export interface OpcionMenu {
  etiqueta: string
  ruta: string
  icono: LucideIcon
  /** Basta con tener uno. Sin permisos = visible para cualquier usuario con sesión */
  permisos?: string[]
  /** true: solo se marca activa en esa ruta exacta (no en sus subrutas) */
  exacta?: boolean
}

export interface GrupoMenu {
  titulo: string
  opciones: OpcionMenu[]
}

// Mismos códigos de permiso que el backend. Ocultar una opción es solo comodidad:
// el backend vuelve a validar cada petición.
export const MENU: GrupoMenu[] = [
  {
    titulo: 'General',
    opciones: [{ etiqueta: 'Inicio', ruta: '/', icono: LayoutDashboard, exacta: true }],
  },
  {
    titulo: 'Operación',
    opciones: [
      { etiqueta: 'Solicitudes', ruta: '/solicitudes', icono: ClipboardList, permisos: ['solicitudes.ver'] },
      {
        etiqueta: 'Permisos de trabajo',
        ruta: '/permisos-trabajo',
        icono: FileCheck,
        permisos: ['permisos_trabajo.emitir', 'permisos_trabajo.revocar'],
      },
      {
        etiqueta: 'Credenciales',
        ruta: '/credenciales',
        icono: BadgeCheck,
        // Los mismos permisos que su ruta en App.tsx: garita consulta credenciales, ve el QR e imprime pases
        permisos: ['credenciales.emitir', 'credenciales.revocar', 'garita.validar'],
      },
    ],
  },
  {
    titulo: 'Garita',
    opciones: [
      { etiqueta: 'Validar acceso', ruta: '/garita', icono: ScanLine, permisos: ['garita.validar'], exacta: true },
      { etiqueta: 'Personas dentro', ruta: '/garita/dentro', icono: Users, permisos: ['accesos.ver_personas_dentro'] },
      {
        etiqueta: 'Movimientos',
        ruta: '/garita/movimientos',
        icono: ArrowLeftRight,
        permisos: ['accesos.ver_personas_dentro', 'reportes.ver'],
      },
    ],
  },
  {
    titulo: 'Personal',
    opciones: [
      { etiqueta: 'Empresas', ruta: '/empresas', icono: Building2, permisos: ['empresas.gestionar'] },
      { etiqueta: 'Contratistas', ruta: '/contratistas', icono: HardHat, permisos: ['contratistas.gestionar'] },
    ],
  },
  {
    titulo: 'Cumplimiento',
    opciones: [
      { etiqueta: 'Documentos', ruta: '/documentos', icono: FileText, permisos: ['documentos.revisar'] },
      { etiqueta: 'Capacitaciones', ruta: '/capacitaciones', icono: GraduationCap, permisos: ['documentos.revisar'] },
    ],
  },
  {
    titulo: 'Seguridad',
    opciones: [
      {
        etiqueta: 'Incidentes',
        ruta: '/incidentes',
        icono: TriangleAlert,
        permisos: ['incidentes.gestionar', 'incidentes.reportar'],
      },
      { etiqueta: 'Bloqueos', ruta: '/bloqueos', icono: Ban, permisos: ['bloqueos.gestionar'] },
    ],
  },
  {
    titulo: 'Administración',
    opciones: [
      { etiqueta: 'Reportes', ruta: '/reportes', icono: FileSpreadsheet, permisos: ['reportes.ver'] },
      { etiqueta: 'Auditoría', ruta: '/auditoria', icono: ScrollText, permisos: ['auditoria.ver'] },
      { etiqueta: 'Usuarios', ruta: '/usuarios', icono: UserCog, permisos: ['usuarios.gestionar'] },
    ],
  },
]
