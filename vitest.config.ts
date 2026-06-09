import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,          // describe / it / test / expect without imports
    environment: 'node',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 20000,     // integration tests hit a real Postgres
  },
});
