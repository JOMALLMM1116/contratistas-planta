import type { Perfil } from './contexto'

/**
 * true si el usuario tiene AL MENOS UNO de los permisos indicados
 * (misma regla que requierePermiso('a', 'b') en el backend).
 * Solo sirve para mostrar u ocultar opciones: el backend valida siempre.
 */
export function tienePermiso(perfil: Perfil | null, ...codigos: string[]): boolean {
  if (!perfil) return false
  return codigos.some((codigo) => perfil.permisos.includes(codigo))
}
