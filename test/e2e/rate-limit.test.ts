import { describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers';
import { createTestDatabase } from './test-db';
import { startTestServer, stopTestServers } from './test-server';

const TEST_DB = testDatabaseUrl('rate_limit');

const baseEnv = {
  NUXT_SESSION_PASSWORD: '01234567890123456789012345678901',
  NUXT_PUBLIC_SHORT_DOMAIN: 'http://localhost:3000',
  NUXT_DATABASE_POOL_MAX: '2',
  NUXT_DATABASE_URL: TEST_DB,
  NUXT_RATE_LIMIT_LOGIN_PER_MINUTE: '3',
};

// The unit test proves the helper. This proves the wiring: a caller who rotates
// X-Forwarded-For must not get a fresh rate-limit bucket on every attempt.
describe('forged X-Forwarded-For', () => {
  it('cannot reset the sign-in rate limit', async () => {
    await createTestDatabase(TEST_DB);
    const host = await startTestServer(baseEnv);

    const attempt = (forged: string) => fetch(`${host}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': forged },
      body: JSON.stringify({ email: `nobody-${forged}@example.com`, password: 'wrong-password-value' }),
    });

    const codes: number[] = [];
    for (let i = 0; i < 8; i++)
      codes.push((await attempt(`10.1.1.${i}`)).status);

    expect(codes).toContain(429);
    await stopTestServers();
  });
});
