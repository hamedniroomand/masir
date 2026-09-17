import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditEvents } from '#server/database/schema';
import {
  e2eSetupOptions,
  insertTestWorkspace,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('audit_events');

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

describe('audit events', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    const otherWorkspace = await insertTestWorkspace(TEST_DB, {
      slug: 'apple',
      ownerUserId: seeded.userId,
    });

    const db = openTestDatabase(TEST_DB);
    await db.insert(auditEvents).values([
      {
        workspaceId: otherWorkspace,
        type: 'link_created',
        detail: { slug: 'other-tenant-secret' },
      },
      // No workspace: a sign-in failure carries an address and belongs to the
      // operator, never to a tenant.
      {
        workspaceId: null,
        type: 'login_failed',
        detail: { email: 'victim@example.com' },
      },
    ]);
  });

  it('never returns another workspace rows', async () => {
    const cookie = await loginCookie();
    const body = await $fetch('/api/admin/audit-events', { headers: { cookie } });
    const dump = JSON.stringify(body);
    expect(dump).not.toContain('other-tenant-secret');
  });

  it('never returns rows that belong to no workspace', async () => {
    const cookie = await loginCookie();
    const body = await $fetch('/api/admin/audit-events', { headers: { cookie } });
    const dump = JSON.stringify(body);
    expect(dump).not.toContain('victim@example.com');
    expect(dump).not.toContain('login_failed');
  });

  it('refuses a caller with no session', async () => {
    await expect($fetch('/api/admin/audit-events')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('stores the detail as a json document', async () => {
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(auditEvents).where(eq(auditEvents.type, 'login_failed'));
    expect(rows[0]!.detail).toEqual({ email: 'victim@example.com' });
  });
});
