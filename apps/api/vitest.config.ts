import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/flowtask',
      JWT_SECRET: 'test-jwt-secret-key-1234567890',
      TELEGRAM_BOT_TOKEN: '123456:TEST_TOKEN',
    },
  },
});
