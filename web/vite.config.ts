import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // La Web se sirve en la raíz del dominio (/). La PWA irá en /pwa.
  base: '/',

  server: {
    port: 5173,
    strictPort: true,
    // En desarrollo, todo lo que empiece con /api se reenvía al backend.
    // Así el navegador cree que Web y API están en el mismo sitio:
    // las cookies HttpOnly funcionan y no hay problemas de CORS.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 todavía usa sintaxis de Sass que las versiones nuevas
        // marcan como obsoleta. Esto oculta esos avisos que vienen de Bootstrap
        // (no de nuestro código) para que la consola quede limpia.
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
})
