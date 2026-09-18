import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditEvents, workspaceMembers, workspaces } from '#server/database/schema';
import { e2eSetupOptions, insertTestUser, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('workspace-logo');
const MEMBER_EMAIL = 'member@example.com';
const STORAGE_ROOT = join(tmpdir(), `masir-logo-${crypto.randomUUID()}`);
const PUBLIC_BASE = 'http://cdn.test/uploads';
const MAX_BYTES = 1024;

let workspaceId = '';

async function loginCookie(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get('set-cookie');
  if (!cookie)
    throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

function png(size = 64) {
  const out = new Uint8Array(size);
  out.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return out;
}

function form(bytes: Uint8Array, name = 'logo.png') {
  const body = new FormData();
  body.set('workspaceId', workspaceId);
  body.set('file', new Blob([bytes]), name);
  return body;
}

type LogoResponse = { logoUrl: string | null };

async function upload(cookie: string, bytes = png()) {
  return $fetch<LogoResponse>('/api/workspaces/logo', { method: 'POST', body: form(bytes), headers: { cookie } });
}

async function storedKey() {
  const db = openTestDatabase(TEST_DB);
  const [row] = await db.select({ logoUrl: workspaces.logoUrl }).from(workspaces).where(eq(workspaces.id, workspaceId));
  return row!.logoUrl;
}

describe('workspace logo', async () => {
  await setup(await e2eSetupOptions(TEST_DB, {
    NUXT_STORAGE_LOCAL_ROOT: STORAGE_ROOT,
    NUXT_STORAGE_PUBLIC_BASE_URL: PUBLIC_BASE,
    NUXT_STORAGE_MAX_UPLOAD_BYTES: String(MAX_BYTES),
  }));

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    const memberId = await insertTestUser(TEST_DB, { email: MEMBER_EMAIL, password: TEST_PASSWORD });
    await openTestDatabase(TEST_DB).insert(workspaceMembers).values({ workspaceId, userId: memberId, role: 'member' });
  });

  it('stores the key, answers the public url, and serves the bytes', async () => {
    const cookie = await loginCookie();
    const res = await upload(cookie);

    const key = await storedKey();
    expect(key).toMatch(new RegExp(`^logos/${workspaceId}/.+\\.png$`));
    expect(res.logoUrl).toBe(`${PUBLIC_BASE}/${key}`);
    expect(await Bun.file(join(STORAGE_ROOT, key!)).exists()).toBe(true);

    const served = await fetch(`/uploads/${key}`);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/png');

    const list = await $fetch<{ items: LogoResponse[] }>('/api/workspaces', { headers: { cookie } });
    expect(list.items[0]!.logoUrl).toBe(res.logoUrl);
  });

  it('writes an audit event like a rename does', async () => {
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(auditEvents).where(and(eq(auditEvents.workspaceId, workspaceId), eq(auditEvents.type, 'workspace_updated')));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.at(-1)!.detail).toEqual({ fields: ['logoUrl'] });
  });

  it('deletes the old file on replace', async () => {
    const cookie = await loginCookie();
    const before = await storedKey();
    const res = await upload(cookie);
    const after = await storedKey();

    expect(after).not.toBe(before);
    expect(res.logoUrl).toBe(`${PUBLIC_BASE}/${after}`);
    expect(await Bun.file(join(STORAGE_ROOT, before!)).exists()).toBe(false);
    expect(await Bun.file(join(STORAGE_ROOT, after!)).exists()).toBe(true);
  });

  it('removes the logo and its file', async () => {
    const cookie = await loginCookie();
    const key = await storedKey();
    const res = await $fetch<LogoResponse>('/api/workspaces/logo', { method: 'DELETE', body: { workspaceId }, headers: { cookie } });

    expect(res.logoUrl).toBeNull();
    expect(await storedKey()).toBeNull();
    expect(await Bun.file(join(STORAGE_ROOT, key!)).exists()).toBe(false);
  });

  it('refuses a member', async () => {
    const cookie = await loginCookie(MEMBER_EMAIL);
    await expect(upload(cookie)).rejects.toMatchObject({ statusCode: 404 });
    await expect($fetch('/api/workspaces/logo', { method: 'DELETE', body: { workspaceId }, headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  it('refuses a file that is not an image', async () => {
    const cookie = await loginCookie();
    const exe = new Uint8Array(64);
    exe.set([0x4D, 0x5A, 0x90, 0x00]);
    await expect(upload(cookie, exe)).rejects.toMatchObject({ statusCode: 422 });
    expect(await storedKey()).toBeNull();
  });

  it('refuses a file over the cap before it writes', async () => {
    const cookie = await loginCookie();
    await expect(upload(cookie, png(MAX_BYTES + 1))).rejects.toMatchObject({ statusCode: 422, data: { data: { reason: expect.stringMatching(/too large/i) } } });
    expect(await storedKey()).toBeNull();
  });

  it('refuses a request without a file', async () => {
    const cookie = await loginCookie();
    const body = new FormData();
    body.set('workspaceId', workspaceId);
    await expect($fetch('/api/workspaces/logo', { method: 'POST', body, headers: { cookie } })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('ignores logoUrl on the workspace patch', async () => {
    const cookie = await loginCookie();
    await $fetch('/api/workspaces', { method: 'PATCH', body: { name: 'Acme', logoUrl: 'https://evil.example/x.svg' }, headers: { cookie } });
    expect(await storedKey()).toBeNull();
  });
});
