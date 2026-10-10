import { fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { links, mailOutbox, workspaceMembers } from '#server/database/schema';
import {
  e2eSetupOptions,
  insertTestLink,
  insertTestUser,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('read-only');
const DEMO_EMAIL = 'demo@example.com';

let demoCookie = '';
let ownerCookie = '';
let linkId = '';

async function loginCookie(email: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  const cookie = res.headers.get('set-cookie');
  if (!cookie)
    throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

function send(method: string, path: string, cookie: string, body?: unknown) {
  return fetch(path, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('read-only accounts', async () => {
  await setup(await e2eSetupOptions(TEST_DB, { NUXT_READ_ONLY_EMAILS: DEMO_EMAIL }));

  beforeAll(async () => {
    const { db, userId, workspaceId } = await resetTestDb(TEST_DB);
    const demoId = await insertTestUser(TEST_DB, { email: DEMO_EMAIL, password: TEST_PASSWORD });
    await db.insert(workspaceMembers).values({ workspaceId, userId: demoId, role: 'viewer' });
    linkId = await insertTestLink(TEST_DB, { workspaceId, createdBy: userId, slug: 'kept', destinationUrl: 'https://example.com/kept' });
    demoCookie = await loginCookie(DEMO_EMAIL);
    ownerCookie = await loginCookie(TEST_EMAIL);
  });

  it('reports the account as read-only with the owner role', async () => {
    const res = await send('GET', '/api/workspaces', demoCookie);
    const body = await res.json() as { readOnly: boolean; items: { role: string }[] };
    expect(body.readOnly).toBe(true);
    expect(body.items[0]!.role).toBe('OWNER');
  });

  it('reads the owner and operator pages', async () => {
    for (const path of ['/api/workspaces/members', '/api/workspaces/invitations', '/api/admin/audit-events', '/api/admin/status'])
      expect((await send('GET', path, demoCookie)).status, path).toBe(200);
  });

  it('refuses every kind of change with 403', async () => {
    const changes: [string, string, unknown?][] = [
      ['POST', '/api/links', { destinationUrl: 'https://example.com/new' }],
      ['PATCH', `/api/links/${linkId}`, { destinationUrl: 'https://example.com/changed' }],
      ['DELETE', `/api/links/${linkId}`],
      ['PATCH', '/api/workspaces', { name: 'Changed' }],
      ['POST', '/api/workspaces/invitations', { email: 'new@example.com', role: 'MEMBER' }],
    ];
    for (const [method, path, body] of changes) {
      const res = await send(method, path, demoCookie, body);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect((await res.json() as { statusMessage: string }).statusMessage).toBe('This account is read-only. Changes are not saved.');
    }

    const db = openTestDatabase(TEST_DB);
    const [link] = await db.select().from(links).where(eq(links.id, linkId));
    expect(link!.destinationUrl).toBe('https://example.com/kept');
    expect(link!.deletedAt).toBeNull();
  });

  it('keeps the owner able to change things', async () => {
    const workspaces = await (await send('GET', '/api/workspaces', ownerCookie)).json() as { readOnly: boolean };
    expect(workspaces.readOnly).toBe(false);
    expect((await send('POST', '/api/links', ownerCookie, { destinationUrl: 'https://example.com/owner' })).status).toBe(201);
  });

  it('sends no password reset to the account and gives the usual answer', async () => {
    const res = await send('POST', '/api/auth/forgot', '', { email: DEMO_EMAIL });
    expect(res.status).toBe(200);
    const db = openTestDatabase(TEST_DB);
    expect(await db.select().from(mailOutbox).where(eq(mailOutbox.to, DEMO_EMAIL))).toHaveLength(0);
  });

  it('lets the account sign out', async () => {
    expect((await send('POST', '/api/auth/logout', demoCookie)).status).toBe(200);
  });
});
