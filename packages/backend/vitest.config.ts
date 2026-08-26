import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    // Testes de integração compartilham um único banco de teste (via
    // DATABASE_URL_TEST) e cada arquivo limpa as tabelas que usa — rodar em
    // série evita testes pisando nos dados uns dos outros.
    fileParallelism: false,
  },
});
