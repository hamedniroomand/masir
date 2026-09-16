import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabasePath } from './helpers';

const TEST_DB = testDatabasePath('password');

async function loginCookie() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const cookie = res.headers.get('set-cookie');
  if (!cookie)
    throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

describe('link password API', async () => {
  await setup(e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('sets, replaces, and removes a password without exposing the hash', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; isProtected: boolean }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/secret' },
      headers: { cookie },
    });
    expect(link.isProtected).toBe(false);

    const protectedLink = await $fetch<Record<string, unknown>>(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { password: 'visitor-secret' },
    });
    expect(protectedLink.isProtected).toBe(true);
    expect(protectedLink).not.toHaveProperty('passwordHash');

    const replaced = await $fetch<{ isProtected: boolean }>(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { password: 'visitor-secret-2' },
    });
    expect(replaced.isProtected).toBe(true);

    const open = await $fetch<{ isProtected: boolean }>(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { cookie },
      body: { password: null },
    });
    expect(open.isProtected).toBe(false);
  });
});
