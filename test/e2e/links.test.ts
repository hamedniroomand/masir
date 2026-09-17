import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { clickEvents } from '#server/database/schema';
import { BROWSER, DEVICE, OUTCOME } from '#shared/codes';
import {
  e2eSetupOptions,
  insertTestCampaign,
  insertTestLink,
  readTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('links');

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

describe('links API', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';

  beforeAll(async () => {
    ({ workspaceId } = await resetTestDb(TEST_DB));
  });

  it('creates a link with only destinationUrl', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ slug: string; shortUrl: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/page' },
      headers: { cookie },
    });
    expect(link.slug).toMatch(/^[a-z0-9-]{7,}$/);
    expect(link.shortUrl).toContain(`/${link.slug}`);
  });

  // A soft delete keeps the row, so the slug stays taken and the history stays
  // readable.
  it('deletes a link and keeps its slug taken', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; slug: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/gone' },
      headers: { cookie },
    });
    await $fetch(`/api/links/${link.id}`, { method: 'DELETE', headers: { cookie } });

    await expect($fetch(`/api/links/${link.id}`, { headers: { cookie } }))
      .rejects
      .toMatchObject({ statusCode: 404 });
    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/again', slug: link.slug },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('keeps the click events of a deleted link', async () => {
    const cookie = await loginCookie();
    const db = openTestDatabase(TEST_DB);
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'with-history' });
    await db.insert(clickEvents).values({
      workspaceId,
      linkId,
      outcome: OUTCOME.redirect_success,
      device: DEVICE.desktop,
      browser: BROWSER.chrome,
      isBot: false,
    });

    await $fetch(`/api/links/${linkId}`, { method: 'DELETE', headers: { cookie } });

    const rows = await db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId));
    expect(rows).toHaveLength(1);
  });

  it('leaves the campaign total unchanged after a link delete', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'spring' });
    await insertTestLink(TEST_DB, { workspaceId, slug: 'camp-a', campaignId, clickCount: 3 });
    const doomed = await insertTestLink(TEST_DB, { workspaceId, slug: 'camp-b', campaignId, clickCount: 4 });

    const readTotal = async () => {
      const list = await $fetch<{ items: { id: string; clickCount: number }[] }>('/api/campaigns', { headers: { cookie } });
      return list.items.find(item => item.id === campaignId)!.clickCount;
    };

    expect(await readTotal()).toBe(7);
    await $fetch(`/api/links/${doomed}`, { method: 'DELETE', headers: { cookie } });
    expect(await readTotal()).toBe(7);
  });

  it('reads the click counter back as a number', async () => {
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'counted', clickCount: 2 });
    const row = await readTestLink(TEST_DB, linkId);
    expect(typeof row.clickCount).toBe('number');
    expect(row.clickCount).toBe(2);
  });

  it('refuses a campaign and an own utm_campaign together', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'summer' });
    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/both', campaignId, utmCampaign: 'own' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('does not expose passwordHash in API responses', async () => {
    const cookie = await loginCookie();
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'protected-link',
      passwordHash: 'hashed-secret',
    });
    const link = await $fetch<Record<string, unknown>>(`/api/links/${linkId}`, { headers: { cookie } });
    expect(link).not.toHaveProperty('passwordHash');
    expect(link.isProtected).toBe(true);
    expect(link.successfulVisitCount).toBe(0);
    expect(link.startsAt).toBeNull();
    expect(link.maximumVisits).toBeNull();
  });

  it('rejects start time after expiry with 422', async () => {
    const cookie = await loginCookie();
    const start = Date.now() + 86400_000;
    const end = Date.now() + 3600_000;
    await expect($fetch('/api/links', {
      method: 'POST',
      body: {
        destinationUrl: 'https://example.com/bad-schedule',
        startsAt: start,
        expiresAt: end,
      },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects javascript destinations with 422', async () => {
    const cookie = await loginCookie();
    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'javascript:alert(1)' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});
