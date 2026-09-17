import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { authIdentities } from '#server/database/schema';
import { newId } from '#shared/id';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('identities');

let userId = '';

async function loginCookie() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

describe('connected identities', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    ({ userId } = await resetTestDb(TEST_DB));
  });

  it('lists the password identity and never its hash', async () => {
    const cookie = await loginCookie();
    const res = await $fetch<{ items: { id: string; provider: string }[] }>('/api/auth/identities', {
      headers: { cookie },
    });
    expect(res.items).toHaveLength(1);
    expect(res.items[0]!.provider).toBe('PASSWORD');
    expect(JSON.stringify(res.items)).not.toContain('passwordHash');
  });

  it('refuses to disconnect the only identity', async () => {
    const cookie = await loginCookie();
    const res = await $fetch<{ items: { id: string }[] }>('/api/auth/identities', { headers: { cookie } });
    await expect($fetch(`/api/auth/identities/${res.items[0]!.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('disconnects one identity when another remains', async () => {
    const db = openTestDatabase(TEST_DB);
    const extraId = newId();
    const now = new Date();
    await db.insert(authIdentities).values({
      id: extraId,
      userId,
      provider: 'GOOGLE',
      providerAccountId: 'google-account-1',
      passwordHash: null,
      createdAt: now,
      updatedAt: now,
    });

    const cookie = await loginCookie();
    const res = await $fetch<{ ok: boolean }>(`/api/auth/identities/${extraId}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(res.ok).toBe(true);

    const after = await $fetch<{ items: unknown[] }>('/api/auth/identities', { headers: { cookie } });
    expect(after.items).toHaveLength(1);
  });

  it('refuses to disconnect an identity of another user', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/auth/identities/${newId()}`, {
      method: 'DELETE',
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
