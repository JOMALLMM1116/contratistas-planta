export type EstadoEmpresa = 'activa' | 'inactiva'

export interface Empresa {
  id: string
  nit: string
  razon_social: string
  nombre_contacto: string | null
  email_contacto: string | null
  telefono: string | null
  direccion: string | null
  estado: EstadoEmpresa
  created_at: string
  updated_at: string
  _count: { contratistas: number; equipos: number }
}

/** Lo que se envía al crear o editar (los opcionales vacíos van como null) */
export interface DatosEmpresa {
  nit: string
  razon_social: string
  nombre_contacto: string | null
  email_contacto: string | null
  telefono: string | null
  direccion: string | null
}