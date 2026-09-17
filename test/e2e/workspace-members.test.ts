import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { users, workspaceMembers, workspaces } from '#server/database/schema';
import { e2eSetupOptions, insertTestUser, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('workspace-members');
const MEMBER_EMAIL = 'member@example.com';

let workspaceId = '';
let ownerUserId = '';
let memberUserId = '';

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

describe('workspace members and owner protection', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    ownerUserId = seeded.userId;

    const db = openTestDatabase(TEST_DB);
    memberUserId = await insertTestUser(TEST_DB, { email: MEMBER_EMAIL, password: TEST_PASSWORD });
    await db.insert(workspaceMembers).values({
      workspaceId,
      userId: memberUserId,
      role: 'member',
    });
  });

  it('lists both members to the owner', async () => {
    const cookie = await loginCookie();
    const res = await $fetch<{ items: { userId: string; email: string; role: string }[] }>('/api/workspaces/members', {
      headers: { cookie },
    });
    expect(res.items).toHaveLength(2);
    expect(res.items.filter(i => i.role === 'OWNER')).toHaveLength(1);
    expect(res.items.map(i => i.userId).sort()).toEqual([memberUserId, ownerUserId].sort());
  });

  it('refuses a member the member list', async () => {
    const cookie = await loginCookie(MEMBER_EMAIL, TEST_PASSWORD);
    await expect($fetch('/api/workspaces/members', { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  it('refuses to deactivate the owner', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/workspaces/members/${ownerUserId}`, {
      method: 'PATCH',
      body: { isActive: false },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('refuses to remove the owner', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/workspaces/members/${ownerUserId}`, {
      method: 'DELETE',
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('deactivates a member and locks them out without touching the user', async () => {
    const cookie = await loginCookie();
    await $fetch(`/api/workspaces/members/${memberUserId}`, {
      method: 'PATCH',
      body: { isActive: false },
      headers: { cookie },
    });

    const memberCookie = await loginCookie(MEMBER_EMAIL, TEST_PASSWORD);
    await expect($fetch('/api/links', { headers: { cookie: memberCookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });

    // The user record itself is untouched, so they still sign in.
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(users).where(eq(users.email, MEMBER_EMAIL));
    expect(rows).toHaveLength(1);

    await $fetch(`/api/workspaces/members/${memberUserId}`, {
      method: 'PATCH',
      body: { isActive: true },
      headers: { cookie },
    });
  });

  it('transfers ownership and leaves exactly one owner', async () => {
    const cookie = await loginCookie();
    await $fetch('/api/workspaces/transfer-ownership', {
      method: 'POST',
      body: { userId: memberUserId },
      headers: { cookie },
    });

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
    expect(rows.filter(r => r.role === 'owner')).toHaveLength(1);
    expect(rows.find(r => r.userId === memberUserId)!.role).toBe('owner');
    expect(rows.find(r => r.userId === ownerUserId)!.role).toBe('member');
  });

  it('refuses the former owner the member controls', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/workspaces/members', { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  // Deleting the only workspace would stop every short link and leave nothing
  // to sign in to, and recreating it does not bring the links back, because
  // they stay attached to the deleted workspace.
  it('refuses to delete the only workspace of a single-workspace instance', async () => {
    const cookie = await loginCookie(MEMBER_EMAIL, TEST_PASSWORD);
    await expect($fetch('/api/workspaces', { method: 'DELETE', headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 409 });

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    expect(rows[0]!.deletedAt).toBeNull();

    // The instance keeps working.
    await expect($fetch('/api/links', { headers: { cookie } })).resolves.toBeTruthy();
  });
});
