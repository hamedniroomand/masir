import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabasePath } from './helpers';

const TEST_DB = testDatabasePath('auth');

describe('auth API', async () => {
  await setup(e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('returns 401 for links without a session', async () => {
    await expect($fetch('/api/links')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('returns the same generic error for wrong password and unknown email', async () => {
    const wrong = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: 'wrong-password' },
    }).catch(e => e);
    const unknown = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'wrong-password' },
    }).catch(e => e);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.data?.error).toBe('Invalid email or password.');
    expect(unknown.data?.error).toBe(wrong.data?.error);
  });

  it('sets a session cookie on successful login', async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/nuxt-session/i);
  });
});
