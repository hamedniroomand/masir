import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditEvents, clickEvents } from '#server/database/schema';
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

  // The clicks of a deleted link belong to the campaign history. The link does
  // not belong to any list a user can act on.
  it('drops a deleted link from the campaign lists but not from the total', async () => {
    const cookie = await loginCookie();
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'autumn' });
    await insertTestLink(TEST_DB, { workspaceId, slug: 'live-one', campaignId, clickCount: 2 });
    const doomed = await insertTestLink(TEST_DB, { workspaceId, slug: 'gone-one', campaignId, clickCount: 5 });

    await $fetch(`/api/links/${doomed}`, { method: 'DELETE', headers: { cookie } });

    const list = await $fetch<{ items: { id: string; linkCount: number; clickCount: number }[] }>(
      '/api/campaigns',
      { headers: { cookie } },
    );
    const listed = list.items.find(item => item.id === campaignId)!;
    expect(listed.clickCount).toBe(7);
    expect(listed.linkCount).toBe(1);

    const analytics = await $fetch<{
      totalClicks: number;
      linkCount: number;
      topLinks: { id: string; slug: string }[];
    }>(`/api/campaigns/${campaignId}/analytics`, { headers: { cookie } });
    expect(analytics.totalClicks).toBe(7);
    expect(analytics.linkCount).toBe(1);
    expect(analytics.topLinks.map(row => row.slug)).toEqual(['live-one']);
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

  it('keeps notes on a link and finds them in a search', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; notes: string | null }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/noted', notes: 'Printed on the conference flyer.' },
      headers: { cookie },
    });
    expect(link.notes).toBe('Printed on the conference flyer.');

    const read = await $fetch<{ notes: string | null }>(`/api/links/${link.id}`, { headers: { cookie } });
    expect(read.notes).toBe('Printed on the conference flyer.');

    const found = await $fetch<{ items: { id: string }[] }>('/api/links', {
      query: { q: 'flyer' },
      headers: { cookie },
    });
    expect(found.items.map(item => item.id)).toContain(link.id);
  });

  it('names notes in the audit fields and refuses a note that is too long', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/audited' },
      headers: { cookie },
    });

    await $fetch(`/api/links/${link.id}`, { method: 'PATCH', body: { notes: 'Asked for by sales.' }, headers: { cookie } });
    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(auditEvents).where(eq(auditEvents.linkId, link.id));
    const updated = rows.find(row => row.type === 'link_updated');
    expect((updated!.detail as { fields: string[] }).fields).toContain('notes');

    await expect($fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { notes: 'x'.repeat(2001) },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('keeps both fallback destinations and refuses one that points at the short link', async () => {
    const cookie = await loginCookie();
    const link = await $fetch<{ id: string; limitDestination: string | null; scheduledDestination: string | null }>('/api/links', {
      method: 'POST',
      body: {
        destinationUrl: 'https://example.com/offer',
        slug: 'fallbacks',
        limitDestination: 'https://example.com/sold-out',
        scheduledDestination: 'https://example.com/coming-soon',
      },
      headers: { cookie },
    });
    expect(link.limitDestination).toBe('https://example.com/sold-out');
    expect(link.scheduledDestination).toBe('https://example.com/coming-soon');

    const read = await $fetch<{ limitDestination: string | null }>(`/api/links/${link.id}`, { headers: { cookie } });
    expect(read.limitDestination).toBe('https://example.com/sold-out');

    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/other', slug: 'self-limit', limitDestination: 'http://localhost:3000/self-limit' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });

    await expect($fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { scheduledDestination: 'http://localhost:3000/fallbacks' },
      headers: { cookie },
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('keeps a targeting map and refuses one with too many countries', async () => {
    const cookie = await loginCookie();
    const targeting = { os: { android: 'https://example.com/play' }, country: { US: 'https://example.com/us' } };
    const link = await $fetch<{ id: string; targeting: typeof targeting | null }>('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/app', targeting },
      headers: { cookie },
    });
    expect(link.targeting).toEqual(targeting);

    const cleared = await $fetch<{ targeting: unknown }>(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: { targeting: { os: {}, country: {} } },
      headers: { cookie },
    });
    expect(cleared.targeting).toBe(null);

    const country: Record<string, string> = {};
    for (let i = 0; i < 21; i++)
      country[`X${String.fromCharCode(65 + i)}`] = 'https://example.com/x';
    await expect($fetch('/api/links', {
      method: 'POST',
      body: { destinationUrl: 'https://example.com/many', targeting: { country } },
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
