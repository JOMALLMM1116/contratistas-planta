import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Proxy compartido por el servidor de desarrollo y la vista previa del build
const proxy = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  // La PWA se sirve en /pwa (la Web está en la raíz /)
  base: '/pwa/',

  plugins: [
    react(),
    VitePWA({
      // El service worker se actualiza solo cuando hay una versión nueva desplegada
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],

      manifest: {
        id: '/pwa/',
        name: 'Control Planta',
        short_name: 'Control Planta',
        description: 'Credencial y actividades del contratista en planta',
        lang: 'es',
        // Alcance /pwa/: el service worker no controla la Web de administración
        start_url: '/pwa/',
        scope: '/pwa/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#315b70',
        background_color: '#f3f5f6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Solo los archivos de la aplicación (para abrir rápido y sin red)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Las fuentes en otros alfabetos no se guardan (la app está en español)
        globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*'],
        // Al navegar sin red se muestra la app; las rutas de la API nunca se responden desde caché
        navigateFallback: '/pwa/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Sin caché en tiempo de ejecución: sesiones, credenciales y archivos privados siempre vienen del servidor
        runtimeCaching: [],
      },
    }),
  ],

  server: {
    port: 5174,
    strictPort: true,
    // Igual que la Web: /api se reenvía al backend (cookies HttpOnly sin CORS)
    proxy,
  },

  // Vista previa del build (npm run preview): aquí sí funciona el service worker
  preview: {
    port: 4174,
    strictPort: true,
    proxy,
  },

  css: {
    preprocessorOptions: {
      scss: {
        // Mismos avisos silenciados que en la Web (vienen de Bootstrap, no de nuestro código)
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
})
