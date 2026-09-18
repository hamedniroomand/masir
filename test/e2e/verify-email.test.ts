import { $fetch, setup } from '@nuxt/test-utils';
import { desc, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { mailOutbox, users } from '#server/database/schema';
import { e2eSetupOptions, resetTestDb, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('verify-email');
const EMAIL = 'verify-me@example.com';

async function lastToken() {
  const db = openTestDatabase(TEST_DB);
  const rows = await db.select().from(mailOutbox).orderBy(desc(mailOutbox.createdAt)).limit(1);
  const match = rows[0]!.text.match(/token=([\w-]+)/);
  return match![1]!;
}

describe('email verification', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: EMAIL, password: 'a-long-enough-pass1!' },
    });
  });

  it('sends a message holding a token', async () => {
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(mailOutbox).where(eq(mailOutbox.to, EMAIL));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.subject).toBe('Verify your email');
  });

  it('puts only the token in the link', async () => {
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(mailOutbox).where(eq(mailOutbox.to, EMAIL));
    expect(rows[0]!.text).toMatch(/verify-email\?token=[\w-]+(\s|$)/);
    expect(rows[0]!.text).not.toContain('email=');
  });

  it('verifies once and refuses the second use', async () => {
    const token = await lastToken();

    const first = await $fetch<{ ok: boolean }>('/api/auth/verify', {
      method: 'POST',
      body: { token },
    });
    expect(first.ok).toBe(true);

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(users).where(eq(users.email, EMAIL));
    expect(rows[0]!.emailVerifiedAt).not.toBeNull();

    await expect($fetch('/api/auth/verify', {
      method: 'POST',
      body: { token },
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses an unknown token', async () => {
    await expect($fetch('/api/auth/verify', {
      method: 'POST',
      body: { token: 'not-a-real-token' },
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('answers the same way when resend gets an unknown email', async () => {
    const res = await $fetch<{ ok: boolean }>('/api/auth/verify/resend', {
      method: 'POST',
      body: { email: 'nobody-here@example.com' },
    });
    expect(res.ok).toBe(true);
  });
});
