import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { workspaceMembers } from '#server/database/schema';
import { e2eSetupOptions, insertTestUser, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('auth');

type FetchError = { statusCode?: number; data?: { error?: string } };

describe('auth API', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId: string;

  beforeAll(async () => {
    ({ workspaceId } = await resetTestDb(TEST_DB));
  });

  it('returns 401 for links without a session', async () => {
    await expect($fetch('/api/links')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('returns the same generic error for wrong password and unknown email', async () => {
    const wrong = await $fetch<never>('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: 'wrong-password' },
    }).catch((e: FetchError) => e);
    const unknown = await $fetch<never>('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'wrong-password' },
    }).catch((e: FetchError) => e);
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

  it('lets a 1.x user who never verified the email sign in and read links', async () => {
    const db = openTestDatabase(TEST_DB);
    const userId = await insertTestUser(TEST_DB, { email: 'unverified@example.com', password: TEST_PASSWORD });
    await db.insert(workspaceMembers).values({ workspaceId, userId, role: 'member' });

    const login = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'unverified@example.com', password: TEST_PASSWORD }),
    });
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    const session = await $fetch<{ user: Record<string, unknown> }>('/api/_auth/session', { headers: { cookie } });
    expect(session.user).not.toHaveProperty('emailVerified');

    const links = await fetch('/api/links', { headers: { cookie } });
    expect(links.status).toBe(200);
  });
});
