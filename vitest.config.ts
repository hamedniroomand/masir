import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

// The compose stack makes this database beside the application one. Each test
// file then creates masir_test_<file> from this connection.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://masir:masir@127.0.0.1:5432/masir_test';

export default defineConfig({
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
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ['test/unit/**/*.test.ts', 'test/e2e/**/*.test.ts'],
    setupFiles: ['./test/setup-teardown.ts'],
    globalSetup: ['./test/global-setup.ts'],
    coverage: {
      // The e2e suite starts the server in its own process, so v8 only sees
      // code this process imports. Route, repo and page modules read low for
      // that reason, and only shared/** has a threshold.
      include: ['shared/**', 'server/utils/**', 'app/composables/**'],
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        'shared/**': { statements: 75, branches: 75, functions: 60, lines: 75 },
      },
    },
    env: {
      VITEST: 'true',
      NUXT_SESSION_PASSWORD: '01234567890123456789012345678901',
      TEST_DATABASE_URL: testDatabaseUrl,
      NUXT_DATABASE_URL: testDatabaseUrl,
      NUXT_PUBLIC_SHORT_DOMAIN: 'http://localhost:3000',
    },
  },
});
