import { fileURLToPath } from 'node:url';
import { defineVitestConfig } from '@nuxt/test-utils/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineVitestConfig({
  resolve: {
    alias: {
      '#server': `${root}server`,
      '#shared': `${root}shared`,
      '#scripts': `${root}scripts`,
      'bun:test': `${root}test/stubs/bun-test.ts`,
    },
  },
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts', 'test/e2e/**/*.test.ts'],
    env: {
      VITEST: 'true',
      NUXT_SESSION_PASSWORD: '01234567890123456789012345678901',
      NUXT_DATABASE_URL: 'file:./data/vitest.db',
      NUXT_PUBLIC_SHORT_DOMAIN: 'http://localhost:3000',
    },
  },
});
