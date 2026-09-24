import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditEvents, links, linkTags, tags } from '#server/database/schema';
import {
  e2eSetupOptions,
  insertTestCampaign,
  insertTestLink,
  insertTestUser,
  insertTestWorkspace,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('links-bulk');

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

describe('links bulk API', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';
  let userId = '';
  let foreignLinkId = '';
  let tagId = '';

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    userId = seeded.userId;

    const otherUser = await insertTestUser(TEST_DB, { email: 'other@example.com', password: TEST_PASSWORD });
    const otherWorkspace = await insertTestWorkspace(TEST_DB, {
      slug: 'other',
      name: 'Other',
      ownerUserId: otherUser,
    });
    foreignLinkId = await insertTestLink(TEST_DB, {
      workspaceId: otherWorkspace,
      createdBy: otherUser,
      slug: 'foreign',
    });

    const db = openTestDatabase(TEST_DB);
    const [tag] = await db.insert(tags).values({
      workspaceId,
      name: 'bulk',
      normalizedName: 'bulk',
    }).returning();
    tagId = tag!.id;
  });

  it('filters the list by campaign and creator', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'filter-camp' });
    const mine = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: userId,
      slug: 'mine-camp',
      campaignId,
    });
    await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: userId,
      slug: 'mine-nocamp',
    });

    const byCampaign = await $fetch<{ items: { id: string }[] }>('/api/links', {
      query: { campaignId },
      headers: { cookie },
    });
    expect(byCampaign.items.map(item => item.id)).toEqual([mine]);

    const byMe = await $fetch<{ items: { id: string }[]; total: number }>('/api/links', {
      query: { createdBy: 'me' },
      headers: { cookie },
    });
    expect(byMe.items.every(item => item.id !== foreignLinkId)).toBe(true);
    expect(byMe.total).toBeGreaterThanOrEqual(2);
  });

  it('tags selected links in one action', async () => {
    const cookie = await loginCookie();
    const a = await insertTestLink(TEST_DB, { workspaceId, createdBy: userId, slug: 'bulk-a' });
    const b = await insertTestLink(TEST_DB, { workspaceId, createdBy: userId, slug: 'bulk-b' });

    const res = await $fetch<{ affected: number; results: { id: string; status: string }[] }>('/api/links/bulk', {
      method: 'POST',
      body: {
        selection: { ids: [a, b] },
        action: 'tag',
        tagId,
      },
      headers: { cookie },
    });
    expect(res.affected).toBe(2);
    expect(res.results.every(row => row.status === 'ok')).toBe(true);

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(linkTags).where(and(eq(linkTags.tagId, tagId)));
    expect(rows.map(row => row.linkId).sort()).toEqual([a, b].sort());

    const audits = await db.select().from(auditEvents).where(eq(auditEvents.type, 'links_bulk_action'));
    expect(audits.some(row => (row.detail as { action?: string })?.action === 'tag')).toBe(true);
  });

  it('refuses ids from another workspace with 404 and no change', async () => {
    const cookie = await loginCookie();
    const local = await insertTestLink(TEST_DB, { workspaceId, createdBy: userId, slug: 'stay-clean' });
    const db = openTestDatabase(TEST_DB);
    const before = await db.select().from(linkTags).where(eq(linkTags.linkId, local));

    const res = await $fetch('/api/links/bulk', {
      method: 'POST',
      body: {
        selection: { ids: [local, foreignLinkId] },
        action: 'tag',
        tagId,
      },
      headers: { cookie },
    }).catch((error: unknown) => error as { data?: { statusCode?: number } });

    expect(res.data?.statusCode).toBe(404);
    const after = await db.select().from(linkTags).where(eq(linkTags.linkId, local));
    expect(after).toHaveLength(before.length);
  });

  it('refuses more than 500 matching links with 422 and no change', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'cap-camp' });
    const db = openTestDatabase(TEST_DB);
    await db.insert(links).values(Array.from({ length: 501 }, (_, index) => ({
      workspaceId,
      createdBy: userId,
      slug: `cap-${String(index).padStart(3, '0')}`,
      campaignId,
      destinationUrl: 'https://example.com/target',
      destinationHost: 'example.com',
    })));

    const [capTag] = await db.insert(tags).values({
      workspaceId,
      name: 'cap',
      normalizedName: 'cap',
    }).returning();

    const before = await db.select().from(linkTags).where(eq(linkTags.tagId, capTag!.id));

    const res = await $fetch('/api/links/bulk', {
      method: 'POST',
      body: {
        selection: { filter: { campaignId } },
        action: 'tag',
        tagId: capTag!.id,
      },
      headers: { cookie },
    }).catch((error: unknown) => error as { data?: { statusCode?: number; data?: { count?: number } } });

    expect(res.data?.statusCode).toBe(422);
    expect(res.data?.data?.count).toBe(501);
    const after = await db.select().from(linkTags).where(eq(linkTags.tagId, capTag!.id));
    expect(after).toHaveLength(before.length);
  });
});
