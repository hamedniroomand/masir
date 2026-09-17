import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { desc } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { mailOutbox } from '#server/database/schema';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('password-reset');
const NEW_PASSWORD = 'a-brand-new-password';

async function lastToken() {
  const db = openTestDatabase(TEST_DB);
  const rows = await db.select().from(mailOutbox).orderBy(desc(mailOutbox.createdAt)).limit(1);
  return rows[0]!.text.match(/token=([\w-]+)/)![1]!;
}

describe('password reset', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('answers the same way for a known and an unknown email', async () => {
    const known = await $fetch<{ message: string }>('/api/auth/forgot', {
      method: 'POST',
      body: { email: TEST_EMAIL },
    });
    const unknown = await $fetch<{ message: string }>('/api/auth/forgot', {
      method: 'POST',
      body: { email: 'nobody-at-all@example.com' },
    });
    expect(known.message).toBe(unknown.message);
    expect(known.message).toMatch(/if an account exists/i);
  });

  it('sets a new password and refuses the old one', async () => {
    const token = await lastToken();
    const res = await $fetch<{ ok: boolean }>('/api/auth/reset', {
      method: 'POST',
      body: { token, password: NEW_PASSWORD },
    });
    expect(res.ok).toBe(true);

    const withNew = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: NEW_PASSWORD }),
    });
    expect(withNew.status).toBe(200);

    const withOld = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    expect(withOld.status).toBe(401);
  });

  it('refuses the same reset token a second time', async () => {
    const token = await lastToken();
    await expect($fetch('/api/auth/reset', {
      method: 'POST',
      body: { token, password: 'yet-another-password' },
    })).rejects.toMatchObject({ statusCode: 400 });
  });
});
