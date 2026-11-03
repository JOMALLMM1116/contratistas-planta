import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Fuente Inter (incluida en el proyecto, sin Google Fonts)
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'

// Mismo tema que la Web
import './estilos/tema.scss'

import App from './App'
import { ErrorApi } from './api/cliente'
import { aplicarTemaInicial } from './apariencia/tema'

// Claro u oscuro antes de dibujar, para que no parpadee
aplicarTemaInicial()

// Consultas a la API: no reintentar errores 4xx (validación, permisos, no encontrado)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (fallos, error) => {
        if (error instanceof ErrorApi && error.status >= 400 && error.status < 500) return false
        return fallos < 2
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* basename: todas las rutas de la PWA viven bajo /pwa */}
      <BrowserRouter basename="/pwa">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
