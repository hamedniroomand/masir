import { $fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { users } from '#server/database/schema';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('register');

describe('registration API', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('creates a user and its password identity', async () => {
    const res = await $fetch<{ ok: boolean }>('/api/auth/register', {
      method: 'POST',
      body: { email: 'new-person@example.com', password: 'a-long-enough-pass1!' },
    });
    expect(res.ok).toBe(true);

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(users).where(eq(users.email, 'new-person@example.com'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.emailVerifiedAt).toBeNull();
  });

  it('answers the same way for an email that already exists', async () => {
    const res = await $fetch<{ ok: boolean }>('/api/auth/register', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: 'another-long-pass2!' },
    });
    expect(res.ok).toBe(true);

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(users).where(eq(users.email, TEST_EMAIL));
    expect(rows).toHaveLength(1);
  });

  it('lowercases the stored email', async () => {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: 'MiXeD@Example.COM', password: 'a-long-enough-pass1!' },
    });
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(users).where(eq(users.email, 'mixed@example.com'));
    expect(rows).toHaveLength(1);
  });

  it.each([
    ['too short', 'shrt1!'],
    ['no number', 'no-number-here!'],
    ['no sign', 'nosignhere12345'],
  ])('refuses a password with %s', async (_label, password) => {
    await expect($fetch('/api/auth/register', {
      method: 'POST',
      body: { email: 'weak@example.com', password },
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});
