import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fuente Inter (incluida en el proyecto, sin Google Fonts)
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'

// Tema del proyecto: Bootstrap compilado con la paleta de Control Planta
import './estilos/tema.scss'

import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
