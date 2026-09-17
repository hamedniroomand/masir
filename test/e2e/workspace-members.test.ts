import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '#scripts/hash-password';
import { authIdentities, users, workspaceMembers, workspaces } from '#server/database/schema';
import { newId } from '#shared/id';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('workspace-members');
const MEMBER_EMAIL = 'member@example.com';

let workspaceId = '';
let ownerMemberId = '';
let memberMemberId = '';

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
    const db = openTestDatabase(TEST_DB);
    const now = new Date();
    const memberUserId = newId();

    await db.insert(users).values({
      id: memberUserId,
      email: MEMBER_EMAIL,
      emailVerifiedAt: now,
      firstName: null,
      lastName: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
    await db.insert(authIdentities).values({
      id: newId(),
      userId: memberUserId,
      provider: 'PASSWORD',
      providerAccountId: memberUserId,
      passwordHash: await hashPassword(TEST_PASSWORD),
      createdAt: now,
      updatedAt: now,
    });
    memberMemberId = newId();
    await db.insert(workspaceMembers).values({
      id: memberMemberId,
      workspaceId,
      userId: memberUserId,
      role: 'MEMBER',
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
    ownerMemberId = rows.find(r => r.role === 'OWNER')!.id;
  });

  it('lists both members to the owner', async () => {
    const cookie = await loginCookie();
    const res = await $fetch<{ items: { email: string; role: string }[] }>('/api/workspaces/members', {
      headers: { cookie },
    });
    expect(res.items).toHaveLength(2);
    expect(res.items.filter(i => i.role === 'OWNER')).toHaveLength(1);
  });

  it('refuses a member the member list', async () => {
    const cookie = await loginCookie(MEMBER_EMAIL, TEST_PASSWORD);
    await expect($fetch('/api/workspaces/members', { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  it('refuses to deactivate the owner', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/workspaces/members/${ownerMemberId}`, {
      method: 'PATCH',
      body: { isActive: false },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('refuses to remove the owner', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/workspaces/members/${ownerMemberId}`, {
      method: 'DELETE',
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('deactivates a member and locks them out without touching the user', async () => {
    const cookie = await loginCookie();
    await $fetch(`/api/workspaces/members/${memberMemberId}`, {
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

    await $fetch(`/api/workspaces/members/${memberMemberId}`, {
      method: 'PATCH',
      body: { isActive: true },
      headers: { cookie },
    });
  });

  it('transfers ownership and leaves exactly one owner', async () => {
    const cookie = await loginCookie();
    await $fetch('/api/workspaces/transfer-ownership', {
      method: 'POST',
      body: { memberId: memberMemberId },
      headers: { cookie },
    });

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
    expect(rows.filter(r => r.role === 'OWNER')).toHaveLength(1);
    expect(rows.find(r => r.id === memberMemberId)!.role).toBe('OWNER');
    expect(rows.find(r => r.id === ownerMemberId)!.role).toBe('MEMBER');
  });

  it('refuses the former owner the member controls', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/workspaces/members', { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  it('hides the workspace after the new owner deletes it', async () => {
    const cookie = await loginCookie(MEMBER_EMAIL, TEST_PASSWORD);
    await $fetch('/api/workspaces', { method: 'DELETE', headers: { cookie } });

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    expect(rows[0]!.deletedAt).not.toBeNull();

    await expect($fetch('/api/links', { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });
});
