import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { and, desc, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditEvents, mailOutbox, workspaceInvitations, workspaceMembers } from '#server/database/schema';
import {
  e2eSetupOptions,
  insertTestCampaign,
  insertTestLink,
  insertTestUser,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('viewer-role');
const VIEWER_EMAIL = 'viewer@example.com';
const PLAIN_EMAIL = 'plain@example.com';
const NULL_ROLE_EMAIL = 'null-role@example.com';
const SWITCH_EMAIL = 'switch@example.com';

let workspaceId = '';
let ownerUserId = '';
let viewerUserId = '';
let switchUserId = '';
let linkId = '';
let campaignId = '';

// Ten logins a minute is the limit. This file signs in more often than that.
const cookies = new Map<string, string>();

async function loginCookie(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const cached = cookies.get(email);
  if (cached)
    return cached;
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get('set-cookie');
  if (!cookie)
    throw new Error('no session cookie');
  const value = cookie.split(';')[0]!;
  cookies.set(email, value);
  return value;
}

async function lastInviteToken() {
  const db = openTestDatabase(TEST_DB);
  const rows = await db.select().from(mailOutbox).orderBy(desc(mailOutbox.createdAt)).limit(1);
  return rows[0]!.text.match(/token=([\w-]+)/)![1]!;
}

async function invite(email: string, role?: string) {
  const cookie = await loginCookie();
  return $fetch<{ id: string }>('/api/workspaces/invitations', {
    method: 'POST',
    body: role ? { email, role } : { email },
    headers: { cookie },
  });
}

async function accept(email: string) {
  const token = await lastInviteToken();
  const cookie = await loginCookie(email, TEST_PASSWORD);
  await $fetch('/api/workspaces/invitations/accept', { method: 'POST', body: { token }, headers: { cookie } });
}

async function memberRole(userId: string) {
  const db = openTestDatabase(TEST_DB);
  const rows = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))).limit(1);
  return rows[0]?.role ?? null;
}

describe('read-only role', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    ownerUserId = seeded.userId;
    linkId = await insertTestLink(TEST_DB, { workspaceId, createdBy: ownerUserId, slug: 'seen' });
    campaignId = await insertTestCampaign(TEST_DB, { workspaceId, createdBy: ownerUserId, utmCampaign: 'spring' });

    viewerUserId = await insertTestUser(TEST_DB, { email: VIEWER_EMAIL, password: TEST_PASSWORD });
    switchUserId = await insertTestUser(TEST_DB, { email: SWITCH_EMAIL, password: TEST_PASSWORD });
    await insertTestUser(TEST_DB, { email: PLAIN_EMAIL, password: TEST_PASSWORD });
    await insertTestUser(TEST_DB, { email: NULL_ROLE_EMAIL, password: TEST_PASSWORD });

    const db = openTestDatabase(TEST_DB);
    await db.insert(workspaceMembers).values([
      { workspaceId, userId: viewerUserId, role: 'viewer' },
      { workspaceId, userId: switchUserId, role: 'member' },
    ]);
  });

  it('lets a viewer read every list and detail route', async () => {
    const cookie = await loginCookie(VIEWER_EMAIL, TEST_PASSWORD);
    const paths = [
      '/api/links',
      `/api/links/${linkId}`,
      `/api/links/${linkId}/analytics`,
      `/api/links/${linkId}/history`,
      '/api/tags',
      '/api/campaigns',
      `/api/campaigns/${campaignId}`,
      `/api/campaigns/${campaignId}/analytics`,
    ];
    for (const path of paths)
      await expect($fetch(path, { headers: { cookie } })).resolves.toBeDefined();

    const qr = await fetch(`/api/links/${linkId}/qr`, { headers: { cookie } });
    expect(qr.status).toBe(200);
  });

  // requireMemberOf answers 404, not 403, so a refusal never confirms that the
  // workspace exists. The guard is shared, so a viewer gets the same answer.
  it('refuses a viewer every write', async () => {
    const cookie = await loginCookie(VIEWER_EMAIL, TEST_PASSWORD);
    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/new' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 404 });

    await expect($fetch(`/api/links/${linkId}`, {
      method: 'PATCH',
      body: { title: 'Nope' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 404 });

    await expect($fetch('/api/tags', {
      method: 'POST',
      body: { name: 'nope' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses a member patch that changes nothing', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/workspaces/members/${switchUserId}`, {
      method: 'PATCH',
      body: {},
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('joins as a viewer when the invitation carries the role', async () => {
    await invite(VIEWER_EMAIL.replace('viewer', 'viewer2'), 'VIEWER');
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(workspaceInvitations).where(eq(workspaceInvitations.email, 'viewer2@example.com')).limit(1);
    expect(rows[0]!.role).toBe('viewer');

    const invitedId = await insertTestUser(TEST_DB, { email: 'viewer2@example.com', password: TEST_PASSWORD });
    await accept('viewer2@example.com');
    expect(await memberRole(invitedId)).toBe('viewer');
  });

  it('joins as a member when the invitation carries no role', async () => {
    await invite(PLAIN_EMAIL);
    await accept(PLAIN_EMAIL);
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(workspaceInvitations).where(eq(workspaceInvitations.email, PLAIN_EMAIL)).limit(1);
    expect(rows[0]!.role).toBe(null);
  });

  it('joins as a member when an old invitation row has a null role', async () => {
    await invite(NULL_ROLE_EMAIL);
    const db = openTestDatabase(TEST_DB);
    await db.update(workspaceInvitations)
      .set({ role: null })
      .where(eq(workspaceInvitations.email, NULL_ROLE_EMAIL));
    await accept(NULL_ROLE_EMAIL);
    const rows = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
    const joined = rows.find(r => r.userId !== ownerUserId && r.role === 'member');
    expect(joined).toBeDefined();
  });

  it('refuses an invitation for the owner role', async () => {
    await expect(invite('owner-try@example.com', 'OWNER')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('changes a member role and writes an audit row', async () => {
    const cookie = await loginCookie();
    await $fetch(`/api/workspaces/members/${switchUserId}`, {
      method: 'PATCH',
      body: { role: 'VIEWER' },
      headers: { cookie },
    });

    const list = await $fetch<{ items: { userId: string; role: string }[] }>('/api/workspaces/members', { headers: { cookie } });
    expect(list.items.find(i => i.userId === switchUserId)!.role).toBe('VIEWER');

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(auditEvents).where(eq(auditEvents.type, 'member_role_changed'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.detail).toMatchObject({ userId: switchUserId, role: 'VIEWER' });
  });

  it('refuses a role change on the owner', async () => {
    const cookie = await loginCookie();
    await expect($fetch(`/api/workspaces/members/${ownerUserId}`, {
      method: 'PATCH',
      body: { role: 'VIEWER' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});
