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

type Row = { id: number; type: string; actorEmail: string | null; linkId: string | null; linkSlug: string | null };
type Page = { items: Row[]; nextBefore: number | null };

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

  it('names the actor and the link on each row', async () => {
    const cookie = await loginCookie();
    const created = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/audited', slug: 'audited' },
      headers: { cookie },
    });

    const body = await $fetch<{ items: Row[] }>('/api/admin/audit-events', { query: { group: 'links' }, headers: { cookie } });
    const row = body.items.find(item => item.linkId === created.id);
    expect(row).toBeDefined();
    expect(row!.actorEmail).toBe(TEST_EMAIL);
    expect(row!.linkSlug).toBe('audited');
  });

  it('returns only link and alias events for the links group', async () => {
    const cookie = await loginCookie();
    const body = await $fetch<{ items: Row[] }>('/api/admin/audit-events', { query: { group: 'links' }, headers: { cookie } });
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items)
      expect(item.type.startsWith('link_') || item.type === 'slug_generation_exhausted').toBe(true);
  });

  it('pages with a cursor and never repeats a row', async () => {
    const cookie = await loginCookie();
    for (let i = 0; i < 4; i++) {
      await $fetch('/api/links', {
        method: 'POST',
        body: { destinationUrl: `https://example.com/page-${i}` },
        headers: { cookie },
      });
    }

    const first = await $fetch<Page>('/api/admin/audit-events', { query: { limit: 2 }, headers: { cookie } });
    expect(first.items).toHaveLength(2);
    expect(first.nextBefore).toBe(first.items[1]!.id);

    const second = await $fetch<Page>('/api/admin/audit-events', { query: { limit: 2, before: first.nextBefore }, headers: { cookie } });
    expect(second.items).toHaveLength(2);
    for (const item of second.items)
      expect(item.id).toBeLessThan(first.nextBefore!);
    const ids = new Set([...first.items, ...second.items].map(item => item.id));
    expect(ids.size).toBe(4);
  });

  it('stores the detail as a json document', async () => {
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(auditEvents).where(eq(auditEvents.type, 'login_failed'));
    expect(rows[0]!.detail).toEqual({ email: 'victim@example.com' });
  });
});
