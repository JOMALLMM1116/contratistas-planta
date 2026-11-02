import type { CuerpoError } from './tipos'

// =============================================================
// Error de la API: conserva el status HTTP y el código del backend
// (VALIDACION, SIN_PERMISO, SESION_EXPIRADA, ...)
// =============================================================
export class ErrorApi extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ErrorApi'
    this.status = status
    this.code = code
    this.details = details
  }
}

// =============================================================
// Aviso de sesión perdida: el proveedor de sesión se suscribe aquí
// para mandar al login cuando la renovación falla.
// =============================================================
type Oyente = () => void
const oyentesSesionPerdida = new Set<Oyente>()

export function alPerderSesion(oyente: Oyente): () => void {
  oyentesSesionPerdida.add(oyente)
  return () => oyentesSesionPerdida.delete(oyente)
}

function avisarSesionPerdida() {
  oyentesSesionPerdida.forEach((oyente) => oyente())
}

// =============================================================
// Renovación de sesión: si varias peticiones expiran a la vez,
// todas esperan UNA sola llamada a /auth/refresh (el backend rota
// el refresh y detectaría reutilización si se llamara dos veces).
// =============================================================
let renovacionEnCurso: Promise<boolean> | null = null

function renovarSesion(): Promise<boolean> {
  if (!renovacionEnCurso) {
    renovacionEnCurso = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        renovacionEnCurso = null
      })
  }
  return renovacionEnCurso
}

// Rutas donde un 401 NO debe intentar renovar la sesión
const RUTAS_SIN_RENOVACION = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/recuperar', '/auth/restablecer']

// =============================================================
// Petición base
// =============================================================
interface OpcionesPeticion {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  cuerpo?: unknown // objeto (se envía como JSON) o FormData (archivos)
  consulta?: Record<string, string | number | boolean | undefined | null>
}

function construirUrl(ruta: string, consulta?: OpcionesPeticion['consulta']): string {
  const params = new URLSearchParams()
  if (consulta) {
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null && valor !== '') params.set(clave, String(valor))
    }
  }
  const texto = params.toString()
  return `/api${ruta}${texto ? `?${texto}` : ''}`
}

async function enviar(ruta: string, opciones: OpcionesPeticion): Promise<Response> {
  const { metodo = 'GET', cuerpo, consulta } = opciones
  const esFormulario = cuerpo instanceof FormData

  try {
    return await fetch(construirUrl(ruta, consulta), {
      method: metodo,
      credentials: 'include',
      headers: cuerpo !== undefined && !esFormulario ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo === undefined ? undefined : esFormulario ? cuerpo : JSON.stringify(cuerpo),
    })
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Intenta de nuevo.')
  }
}

async function leerError(respuesta: Response): Promise<ErrorApi> {
  try {
    const cuerpo = (await respuesta.json()) as CuerpoError
    const { code, message, details } = cuerpo.error
    return new ErrorApi(respuesta.status, code, message, details)
  } catch {
    return new ErrorApi(respuesta.status, 'ERROR_DESCONOCIDO', `Error inesperado del servidor (${respuesta.status}).`)
  }
}

/** Hace la petición; ante 401 SESION_EXPIRADA renueva la sesión y reintenta una vez. */
async function peticionCruda(ruta: string, opciones: OpcionesPeticion = {}): Promise<Response> {
  let respuesta = await enviar(ruta, opciones)

  if (respuesta.status === 401 && !RUTAS_SIN_RENOVACION.includes(ruta)) {
    const error = await leerError(respuesta.clone())
    if (error.code === 'SESION_EXPIRADA' && (await renovarSesion())) {
      respuesta = await enviar(ruta, opciones)
    }
    if (respuesta.status === 401) {
      avisarSesionPerdida()
    }
  }

  if (!respuesta.ok) throw await leerError(respuesta)
  return respuesta
}

/** Petición que devuelve el JSON del backend tal cual ({ datos } o { datos, meta }). */
export async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const respuesta = await peticionCruda(ruta, opciones)
  if (respuesta.status === 204) return undefined as T
  return (await respuesta.json()) as T
}

// =============================================================
// Atajos
// =============================================================
export const api = {
  get: <T>(ruta: string, consulta?: OpcionesPeticion['consulta']) => peticion<T>(ruta, { consulta }),
  post: <T>(ruta: string, cuerpo?: unknown) => peticion<T>(ruta, { metodo: 'POST', cuerpo: cuerpo ?? {} }),
  patch: <T>(ruta: string, cuerpo: unknown) => peticion<T>(ruta, { metodo: 'PATCH', cuerpo }),
  delete: <T>(ruta: string) => peticion<T>(ruta, { metodo: 'DELETE' }),

  /** Descarga un archivo (PDF del pase, Excel/PDF de reportes) y lo abre o guarda. */
  async descargar(ruta: string, nombreArchivo: string, consulta?: OpcionesPeticion['consulta']) {
    const respuesta = await peticionCruda(ruta, { consulta })
    const blob = await respuesta.blob()
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombreArchivo
    enlace.click()
    URL.revokeObjectURL(url)
  },
}
