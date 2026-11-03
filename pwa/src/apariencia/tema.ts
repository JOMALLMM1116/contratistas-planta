import { useSyncExternalStore } from 'react'

// Tema claro / oscuro de Bootstrap 5.3 (atributo data-bs-theme en <html>)
export type Tema = 'light' | 'dark'

const CLAVE = 'cp_tema'
const oyentes = new Set<() => void>()

function leerTemaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === 'light' || guardado === 'dark') return guardado
  } catch {
    // Navegador sin almacenamiento: se usa la preferencia del sistema
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let temaActual: Tema = leerTemaInicial()

/** Se llama en main.tsx ANTES de dibujar la app, para evitar un parpadeo de color */
export function aplicarTemaInicial() {
  document.documentElement.setAttribute('data-bs-theme', temaActual)
}

export function cambiarTema(tema: Tema) {
  temaActual = tema
  document.documentElement.setAttribute('data-bs-theme', tema)
  try {
    localStorage.setItem(CLAVE, tema)
  } catch {
    // Sin almacenamiento: el cambio dura hasta recargar
  }
  oyentes.forEach((oyente) => oyente())
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Tema actual y función para alternarlo, desde cualquier componente */
export function useTema() {
  const tema = useSyncExternalStore(suscribir, () => temaActual)
  return {
    tema,
    alternar: () => cambiarTema(temaActual === 'dark' ? 'light' : 'dark'),
  }
}
