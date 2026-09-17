import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { desc, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { authIdentities, mailOutbox, users, workspaceMembers } from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
import { newId } from '#shared/id';
import { e2eSetupOptions, resetTestDb, TEST_EMAIL, TEST_PASSWORD, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('invitations');
const INVITEE = 'invitee@example.com';
const OUTSIDER = 'outsider@example.com';

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

async function makeUser(email: string) {
  const db = openTestDatabase(TEST_DB);
  const id = newId();
  const now = new Date();
  await db.insert(users).values({
    id,
    email,
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
    userId: id,
    provider: 'PASSWORD',
    providerAccountId: id,
    passwordHash: await hashSecret(TEST_PASSWORD),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function lastInviteToken() {
  const db = openTestDatabase(TEST_DB);
  const rows = await db.select().from(mailOutbox).orderBy(desc(mailOutbox.createdAt)).limit(1);
  return rows[0]!.text.match(/token=([\w-]+)/)![1]!;
}

describe('workspace invitations', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    ({ workspaceId } = await resetTestDb(TEST_DB));
    await makeUser(INVITEE);
    await makeUser(OUTSIDER);
  });

  it('sends an invitation and lists it as pending', async () => {
    const cookie = await loginCookie();
    const created = await $fetch<{ id: string; email: string }>('/api/workspaces/invitations', {
      method: 'POST',
      body: { email: INVITEE },
      headers: { cookie },
    });
    expect(created.email).toBe(INVITEE);

    const list = await $fetch<{ items: { email: string }[] }>('/api/workspaces/invitations', { headers: { cookie } });
    expect(list.items.map(i => i.email)).toContain(INVITEE);
    expect(JSON.stringify(list.items)).not.toContain('tokenHash');
  });

  it('refuses an invitation for somebody who is already a member', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/workspaces/invitations', {
      method: 'POST',
      body: { email: TEST_EMAIL },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses acceptance by another email address', async () => {
    const token = await lastInviteToken();
    const cookie = await loginCookie(OUTSIDER, TEST_PASSWORD);
    await expect($fetch('/api/workspaces/invitations/accept', {
      method: 'POST',
      body: { token },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('lets the invited address join and refuses the second use', async () => {
    const token = await lastInviteToken();
    const cookie = await loginCookie(INVITEE, TEST_PASSWORD);

    const res = await $fetch<{ ok: boolean }>('/api/workspaces/invitations/accept', {
      method: 'POST',
      body: { token },
      headers: { cookie },
    });
    expect(res.ok).toBe(true);

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
    expect(rows).toHaveLength(2);
    expect(rows.filter(r => r.role === 'OWNER')).toHaveLength(1);

    await expect($fetch('/api/workspaces/invitations/accept', {
      method: 'POST',
      body: { token },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses a revoked invitation', async () => {
    const cookie = await loginCookie();
    const created = await $fetch<{ id: string }>('/api/workspaces/invitations', {
      method: 'POST',
      body: { email: OUTSIDER },
      headers: { cookie },
    });
    const token = await lastInviteToken();

    await $fetch(`/api/workspaces/invitations/${created.id}`, { method: 'DELETE', headers: { cookie } });

    const outsiderCookie = await loginCookie(OUTSIDER, TEST_PASSWORD);
    await expect($fetch('/api/workspaces/invitations/accept', {
      method: 'POST',
      body: { token },
      headers: { cookie: outsiderCookie },
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses a member who tries to invite', async () => {
    const cookie = await loginCookie(INVITEE, TEST_PASSWORD);
    await expect($fetch('/api/workspaces/invitations', {
      method: 'POST',
      body: { email: 'someone-else@example.com' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
