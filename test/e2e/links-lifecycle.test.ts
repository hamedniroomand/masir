import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditEvents, links, workspaceMembers } from '#server/database/schema';
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

const TEST_DB = testDatabaseUrl('links-lifecycle');
const MEMBER_EMAIL = 'member-life@example.com';
const VIEWER_EMAIL = 'viewer-life@example.com';

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

describe('link responsibility, review, archive, and trash', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';
  let ownerId = '';
  let memberId = '';
  let viewerId = '';

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    ownerId = seeded.userId;
    memberId = await insertTestUser(TEST_DB, { email: MEMBER_EMAIL, password: TEST_PASSWORD });
    viewerId = await insertTestUser(TEST_DB, { email: VIEWER_EMAIL, password: TEST_PASSWORD });
    const db = openTestDatabase(TEST_DB);
    await db.insert(workspaceMembers).values([
      { workspaceId, userId: memberId, role: 'member' },
      { workspaceId, userId: viewerId, role: 'viewer' },
    ]);
  });

  it('removes a member and clears responsibility into needsReview', async () => {
    const cookie = await loginCookie();
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: ownerId,
      slug: 'owned-by-member',
      responsibleUserId: memberId,
      reviewAt: new Date(Date.now() + 86_400_000),
    });

    await $fetch(`/api/workspaces/members/${memberId}`, {
      method: 'DELETE',
      headers: { cookie },
    });

    const db = openTestDatabase(TEST_DB);
    const [row] = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
    expect(row?.responsibleUserId).toBeNull();

    const list = await $fetch<{ items: { id: string }[]; total: number }>('/api/links', {
      query: { needsReview: 'true' },
      headers: { cookie },
    });
    expect(list.items.map(item => item.id)).toContain(linkId);
  });

  it('keeps an archived link answering 302', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; slug: string; archived: boolean }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/archived-target', slug: 'still-live' },
      headers: { cookie },
    });

    const patched = await $fetch<{ archived: boolean }>(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { archived: true },
      headers: { cookie },
    });
    expect(patched.archived).toBe(true);

    const listed = await $fetch<{ items: { id: string }[] }>('/api/links', { headers: { cookie } });
    expect(listed.items.map(item => item.id)).not.toContain(link.id);

    const archived = await $fetch<{ items: { id: string }[] }>('/api/links', {
      query: { archived: 'true' },
      headers: { cookie },
    });
    expect(archived.items.map(item => item.id)).toContain(link.id);

    const res = await fetch('/still-live', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/archived-target');
  });

  it('refuses a viewer who archives a link with 404', async () => {
    const ownerCookie = await loginCookie();
    const link = await $fetch<{ id: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/viewer-archive', slug: 'viewer-archive' },
      headers: { cookie: ownerCookie },
    });

    const viewerCookie = await loginCookie(VIEWER_EMAIL, TEST_PASSWORD);
    await expect($fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { archived: true },
      headers: { cookie: viewerCookie },
    })).rejects.toMatchObject({ statusCode: 404 });

    const db = openTestDatabase(TEST_DB);
    const [row] = await db.select().from(links).where(eq(links.id, link.id)).limit(1);
    expect(row?.archivedAt).toBeNull();
  });

  it('records a responsibility change in history with the actor', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/responsible', slug: 'with-owner' },
      headers: { cookie },
    });

    // Re-add the member removed earlier so assignment is valid.
    const db = openTestDatabase(TEST_DB);
    const existing = await db.select().from(workspaceMembers).where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, memberId),
    ));
    if (!existing.length) {
      await db.insert(workspaceMembers).values({
        workspaceId,
        userId: memberId,
        role: 'member',
      });
    }

    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { responsibleUserId: memberId },
      headers: { cookie },
    });

    const history = await $fetch<{ items: { type: string; actorName: string | null }[] }>(
      `/api/links/${link.id}/history`,
      { headers: { cookie } },
    );
    const change = history.items.find(item => item.type === 'link_responsible_changed');
    expect(change).toBeTruthy();
    expect(change!.actorName).toBe(TEST_EMAIL);

    const audits = await db.select().from(auditEvents).where(and(
      eq(auditEvents.type, 'link_responsible_changed'),
      eq(auditEvents.linkId, link.id),
    ));
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorId).toBe(ownerId);
  });

  it('archives selected links through bulk action', async () => {
    const cookie = await loginCookie();
    const a = await insertTestLink(TEST_DB, { workspaceId, createdBy: ownerId, slug: 'bulk-arch-a' });
    const b = await insertTestLink(TEST_DB, { workspaceId, createdBy: ownerId, slug: 'bulk-arch-b' });

    const res = await $fetch<{ affected: number }>('/api/links/bulk', {
      method: 'POST',
      body: { selection: { ids: [a, b] }, action: 'archive' },
      headers: { cookie },
    });
    expect(res.affected).toBe(2);

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(links).where(and(eq(links.workspaceId, workspaceId)));
    expect(rows.filter(row => row.id === a || row.id === b).every(row => row.archivedAt != null)).toBe(true);
  });

  it('refuses a responsible user who is not an active member', async () => {
    const cookie = await loginCookie();
    const link = await insertTestLink(TEST_DB, { workspaceId, createdBy: ownerId, slug: 'bad-responsible' });
    const stranger = await insertTestUser(TEST_DB, { email: 'stranger-life@example.com', password: TEST_PASSWORD });

    await expect($fetch(`/api/links/${link}`, {
      method: 'PATCH',
      body: { responsibleUserId: stranger },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('deletes a link with an alias, restores both addresses, and holds the slug', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/trash-target', slug: 'trash-primary' },
      headers: { cookie },
    });
    await $fetch(`/api/links/${link.id}/aliases`, {
      method: 'POST',
      body: { slug: 'trash-alias' },
      headers: { cookie },
    });

    await $fetch(`/api/links/${link.id}`, { method: 'DELETE', headers: { cookie } });

    expect((await fetch('/trash-primary', { redirect: 'manual' })).status).toBe(404);
    expect((await fetch('/trash-alias', { redirect: 'manual' })).status).toBe(404);

    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/taken', slug: 'trash-primary' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 409 });

    const trash = await $fetch<{ items: { id: string }[] }>('/api/links', {
      query: { trashed: 'true' },
      headers: { cookie },
    });
    expect(trash.items.map(item => item.id)).toContain(link.id);

    const restored = await $fetch<{ id: string; status: string; slug: string }>(
      `/api/links/${link.id}/restore`,
      { method: 'POST', headers: { cookie } },
    );
    expect(restored.slug).toBe('trash-primary');
    expect(restored.status).toBe('active');

    const primary = await fetch('/trash-primary', { redirect: 'manual' });
    expect(primary.status).toBe(302);
    expect(primary.headers.get('location')).toBe('https://example.com/trash-target');
    const alias = await fetch('/trash-alias', { redirect: 'manual' });
    expect(alias.status).toBe(302);
    expect(alias.headers.get('location')).toBe('https://example.com/trash-target');
  });

  it('restores an expired link with status expired', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string }>('/api/links', {
      method: 'POST',
      body: {
        destinationUrl: 'https://example.com/expired-trash',
        slug: 'expired-trash',
      },
      headers: { cookie },
    });
    await $fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { expiresAt: Date.now() - 60_000 },
      headers: { cookie },
    });

    await $fetch(`/api/links/${link.id}`, { method: 'DELETE', headers: { cookie } });
    const restored = await $fetch<{ status: string }>(`/api/links/${link.id}/restore`, {
      method: 'POST',
      headers: { cookie },
    });
    expect(restored.status).toBe('expired');
  });

  it('refuses a viewer who restores a link with 404', async () => {
    const ownerCookie = await loginCookie();
    const link = await $fetch<{ id: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/viewer-restore', slug: 'viewer-restore' },
      headers: { cookie: ownerCookie },
    });
    await $fetch(`/api/links/${link.id}`, { method: 'DELETE', headers: { cookie: ownerCookie } });

    const viewerCookie = await loginCookie(VIEWER_EMAIL, TEST_PASSWORD);
    await expect($fetch(`/api/links/${link.id}/restore`, {
      method: 'POST',
      headers: { cookie: viewerCookie },
    })).rejects.toMatchObject({ statusCode: 404 });

    const trash = await $fetch<{ items: { id: string }[] }>('/api/links', {
      query: { trashed: 'true' },
      headers: { cookie: ownerCookie },
    });
    expect(trash.items.map(item => item.id)).toContain(link.id);
  });
});
