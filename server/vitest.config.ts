import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Las pruebas comparten la misma base de datos: se ejecutan en orden, una a la vez
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Solo errores en los logs del servidor durante las pruebas (el .env no lo sobrescribe)
    env: {
      LOG_LEVEL: 'error',
    },
  },
});
