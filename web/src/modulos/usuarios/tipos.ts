export interface PermisoRol {
  codigo: string
  descripcion?: string | null
}

export interface Rol {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  es_interno: boolean
  permisos: PermisoRol[]
}

export interface Usuario {
  id: string
  email: string
  nombre_completo: string
  activo: boolean
  debe_cambiar_password: boolean
  ultimo_acceso: string | null
  created_at: string
  rol_id: number
  empresa_id: string | null
  roles: { id: number; codigo: string; nombre: string; es_interno: boolean }
  empresas_contratistas: { id: string; nit: string; razon_social: string } | null
}

/** Empresa tal como la devuelve /empresas-contratistas (solo lo que usan los selectores) */
export interface EmpresaOpcion {
  id: string
  nit: string
  razon_social: string
  estado: 'activa' | 'inactiva'
}

/** Lo que se envía al crear un usuario */
export interface DatosNuevoUsuario {
  email: string
  nombre_completo: string
  rol_id: number
  empresa_id: string | null
  password: string
}

/** Lo que se envía al editar: solo los campos que cambiaron */
export interface CambiosUsuario {
  nombre_completo?: string
  rol_id?: number
  empresa_id?: string | null
  activo?: boolean
}

export interface RespuestaPassword {
  usuario: Usuario
  password_temporal: string
}