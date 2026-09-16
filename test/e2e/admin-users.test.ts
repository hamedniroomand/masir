import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '#scripts/hash-password';
import { users } from '#server/database/schema';
import { newId } from '#shared/id';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('admin-users');
const SUPER_EMAIL = 'super@example.com';

let superId = '';

async function loginCookie(email: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

describe('admin users API', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
    const db = openTestDatabase(TEST_DB);
    superId = newId();
    await db.insert(users).values({
      id: superId,
      email: SUPER_EMAIL,
      passwordHash: await hashPassword(TEST_PASSWORD),
      name: 'Super Admin',
      role: 'admin',
      isActive: true,
      isSuperAdmin: true,
      createdAt: new Date(),
    });
  });

  it('refuses to deactivate the super admin from another admin', async () => {
    const cookie = await loginCookie(TEST_EMAIL);
    await expect($fetch(`/api/admin/users/${superId}`, {
      method: 'PATCH',
      body: { isActive: false },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses to demote the super admin from another admin', async () => {
    const cookie = await loginCookie(TEST_EMAIL);
    await expect($fetch(`/api/admin/users/${superId}`, {
      method: 'PATCH',
      body: { role: 'member' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('lets the super admin change their own account', async () => {
    const cookie = await loginCookie(SUPER_EMAIL);
    await expect($fetch(`/api/admin/users/${superId}`, {
      method: 'PATCH',
      body: { isActive: false },
      headers: { cookie },
    })).resolves.toMatchObject({ ok: true });
  });

  it('exposes isSuperAdmin to the users list', async () => {
    const cookie = await loginCookie(TEST_EMAIL);
    const res = await $fetch<{ items: { id: string; isSuperAdmin: boolean }[] }>('/api/admin/users', { headers: { cookie } });
    expect(res.items.find(u => u.id === superId)?.isSuperAdmin).toBe(true);
  });
});
