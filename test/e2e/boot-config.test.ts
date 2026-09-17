import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers';
import { createTestDatabase } from './test-db';
import { startTestServer, stopTestServers } from './test-server';

const TEST_DB = testDatabaseUrl('boot_config');

const baseEnv = {
  NUXT_SESSION_PASSWORD: '01234567890123456789012345678901',
  NUXT_PUBLIC_SHORT_DOMAIN: 'http://localhost:3000',
  NUXT_DATABASE_POOL_MAX: '2',
  NUXT_DATABASE_URL: TEST_DB,
  NUXT_MULTI_WORKSPACE: 'true',
  NUXT_ROOT_DOMAIN: 'http://localhost:3000',
};

// A hand-built config object cannot catch this. NUXT_SESSION_COOKIE_DOMAIN only
// binds when nuxt.config declares runtimeConfig.session.cookie.domain, so the
// only honest test starts the real server and reads what it did.
describe('multi-workspace boot', () => {
  beforeAll(async () => {
    await createTestDatabase(TEST_DB);
  });

  afterAll(async () => {
    await stopTestServers();
  });

  it('starts when the session cookie domain is set', async () => {
    const host = await startTestServer({ ...baseEnv, NUXT_SESSION_COOKIE_DOMAIN: '.localhost' });
    const res = await fetch(`${host}/api/health`);
    expect(res.status).toBe(200);
  });

  it('refuses to start when the session cookie domain is missing', async () => {
    await expect(startTestServer(baseEnv)).rejects.toThrow(/NUXT_SESSION_COOKIE_DOMAIN must be set/);
  });
});
