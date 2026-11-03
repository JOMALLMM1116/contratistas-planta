export type EstadoContratista = 'activo' | 'inactivo'

export interface EmpresaResumen {
  id: string
  nit: string
  razon_social: string
}

export interface Contratista {
  id: string
  empresa_id: string
  usuario_id: string | null
  documento_identidad: string
  nombres: string
  apellidos: string
  email: string | null
  telefono: string | null
  cargo: string | null
  estado: EstadoContratista
  created_at: string
  updated_at: string
  empresas_contratistas: EmpresaResumen
}

/** Lo que se envía al crear o editar (los opcionales vacíos van como null) */
export interface DatosContratista {
  empresa_id: string
  documento_identidad: string
  nombres: string
  apellidos: string
  email: string | null
  telefono: string | null
  cargo: string | null
}

