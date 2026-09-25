import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureClickEventPartitions } from '#server/database/migrate';
import { clickEvents, links } from '#server/database/schema';
import { BROWSER, DEVICE, OUTCOME } from '#shared/codes';
import {
  CHROME_UA,
  e2eSetupOptions,
  insertTestCampaign,
  insertTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
  waitFor,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('analytics');

type Breakdown = { label: string; count: number };

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

describe('link analytics', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';

  beforeAll(async () => {
    ({ workspaceId } = await resetTestDb(TEST_DB));
  });

  it('records outcomes for blocked paths and bot traffic', async () => {
    const disabledId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-disabled', isEnabled: false });
    await fetch('/an-disabled', { headers: { accept: 'application/json', 'user-agent': CHROME_UA } });

    const scheduledId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'an-scheduled',
      startsAt: new Date(Date.now() + 86400_000),
    });
    await fetch('/an-scheduled', { headers: { accept: 'application/json', 'user-agent': CHROME_UA } });

    const expiredId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'an-expired',
      expiresAt: new Date(Date.now() - 1000),
    });
    await fetch('/an-expired', { headers: { accept: 'application/json', 'user-agent': CHROME_UA } });

    const botId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-bot' });
    await fetch('/an-bot', { redirect: 'manual', headers: { 'user-agent': 'Googlebot/2.1' } });

    const db = openTestDatabase(TEST_DB);
    const outcomes = (linkId: string, expected: number) => waitFor(
      async () => {
        const rows = await db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId));
        return rows.map(r => r.outcome);
      },
      found => found.includes(expected),
    );

    expect(await outcomes(disabledId, OUTCOME.disabled_block)).toContain(OUTCOME.disabled_block);
    expect(await outcomes(scheduledId, OUTCOME.scheduled_block)).toContain(OUTCOME.scheduled_block);
    expect(await outcomes(expiredId, OUTCOME.expired_block)).toContain(OUTCOME.expired_block);
    expect(await outcomes(botId, OUTCOME.bot_request)).toContain(OUTCOME.bot_request);

    const botLink = await db.select().from(links).where(eq(links.id, botId)).limit(1);
    expect(botLink[0]?.clickCount).toBe(0);
  });

  it('counts unique visitors without storing raw IP', async () => {
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-unique' });
    for (let i = 0; i < 5; i++) {
      await fetch('/an-unique', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    }

    const db = openTestDatabase(TEST_DB);
    await waitFor(
      async () => db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId)),
      found => found.length >= 5,
    );

    const cookie = await loginCookie();
    const stats = await $fetch<{
      totalClicks: number;
      uniqueVisitors: number;
      periodClicks: number;
    }>(`/api/links/${linkId}/analytics`, { query: { period: '24h' }, headers: { cookie } });

    expect(stats.totalClicks).toBe(5);
    expect(stats.uniqueVisitors).toBe(1);

    const rows = await db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId));
    const stored = JSON.stringify(rows, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
    expect(stored).not.toContain('127.0.0.1');
    expect(rows.every(r => typeof r.visitorHash === 'bigint')).toBe(true);
  });

  it('filters chart traffic by classification', async () => {
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-traffic' });
    await fetch('/an-traffic', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    await fetch('/an-traffic', { redirect: 'manual', headers: { 'user-agent': 'Googlebot/2.1' } });

    const cookie = await loginCookie();
    const human = await $fetch<{ periodClicks: number }>(`/api/links/${linkId}/analytics`, {
      query: { period: '24h', traffic: 'human' },
      headers: { cookie },
    });
    const bot = await $fetch<{ periodClicks: number }>(`/api/links/${linkId}/analytics`, {
      query: { period: '24h', traffic: 'bot' },
      headers: { cookie },
    });
    expect(human.periodClicks).toBe(1);
    expect(bot.periodClicks).toBe(1);
  });

  it('answers with labels, never codes, and without the legacy fields', async () => {
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-labels' });
    const db = openTestDatabase(TEST_DB);
    await db.insert(clickEvents).values({
      workspaceId,
      linkId,
      outcome: OUTCOME.redirect_success,
      device: DEVICE.mobile,
      browser: BROWSER.safari,
      country: 'NL',
      isBot: false,
      visitorHash: 42n,
    });

    const cookie = await loginCookie();
    const stats = await $fetch<Record<string, unknown> & {
      devices: Breakdown[];
      browsers: Breakdown[];
      topCountries: Breakdown[];
      topReferrers: Breakdown[];
    }>(`/api/links/${linkId}/analytics`, { query: { period: '24h' }, headers: { cookie } });

    expect(stats).not.toHaveProperty('classificationAvailableFrom');
    expect(stats).not.toHaveProperty('periodCoversLegacy');

    expect(stats.devices).toEqual([{ label: 'mobile', count: 1, percentage: 100 }]);
    expect(stats.browsers).toEqual([{ label: 'safari', count: 1, percentage: 100 }]);
    expect(stats.topCountries).toEqual([{ label: 'NL', count: 1 }]);
    for (const row of [...stats.devices, ...stats.browsers, ...stats.topCountries, ...stats.topReferrers])
      expect(typeof row.label).toBe('string');
  });

  it('puts an older event in the partition of its month', async () => {
    const db = openTestDatabase(TEST_DB);
    const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15));
    await ensureClickEventPartitions(db, lastMonth);

    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-partition' });
    await db.insert(clickEvents).values({
      workspaceId,
      linkId,
      createdAt: lastMonth,
      outcome: OUTCOME.redirect_success,
      device: DEVICE.desktop,
      browser: BROWSER.chrome,
      isBot: false,
    });

    const rows = await db.select({ table: sql<string>`tableoid::regclass::text` })
      .from(clickEvents)
      .where(eq(clickEvents.linkId, linkId));
    const month = String(lastMonth.getUTCMonth() + 1).padStart(2, '0');
    expect(rows[0]!.table).toBe(`click_events_${lastMonth.getUTCFullYear()}_${month}`);
  });

  it('returns explicit metric fields and response metadata', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'an-meta-fields',
      maximumVisits: 10,
    });
    for (let i = 0; i < 3; i++) {
      await fetch('/an-meta-fields', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    }

    const cookie = await loginCookie();
    const linkStats = await $fetch<{
      totalClicks: number;
      lifetimeClicks: number;
      usedVisits: number;
      remainingVisits: number;
      maximumVisits: number;
      meta: { timezone: string; period: string; traffic: string };
    }>(`/api/links/${linkId}/analytics`, { query: { period: '7d', traffic: 'human' }, headers: { cookie } });

    expect(linkStats.lifetimeClicks).toBe(3);
    expect(linkStats.totalClicks).toBe(3);
    expect(linkStats.usedVisits).toBe(3);
    expect(linkStats.remainingVisits).toBe(7);
    expect(linkStats.maximumVisits).toBe(10);
    expect(linkStats.meta).toEqual({
      timezone: 'UTC',
      period: '7d',
      traffic: 'human',
    });

    const wsStats = await $fetch<{
      meta: { timezone: string; period: string; traffic: string };
    }>('/api/workspaces/analytics', { query: { period: '7d' }, headers: { cookie } });

    expect(wsStats.meta).toEqual({
      timezone: 'UTC',
      period: '7d',
      traffic: 'human',
    });
  });

  it('custom ranges keep a boundary event in one window only', async () => {
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'boundary' });
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-boundary', campaignId });
    const db = openTestDatabase(TEST_DB);
    await ensureClickEventPartitions(db, new Date('2026-09-01T00:00:00.000Z'));
    await db.insert(clickEvents).values({
      workspaceId,
      linkId,
      campaignId,
      outcome: OUTCOME.redirect_success,
      device: DEVICE.desktop,
      browser: BROWSER.chrome,
      isBot: false,
      visitorHash: 7n,
      createdAt: new Date('2026-09-10T00:00:00.000Z'),
    });

    const cookie = await loginCookie();
    const leftQuery = { from: '2026-09-03', to: '2026-09-10' };
    const rightQuery = { from: '2026-09-10', to: '2026-09-17' };

    const linkLeft = await $fetch<{ periodClicks: number }>(`/api/links/${linkId}/analytics`, {
      query: leftQuery,
      headers: { cookie },
    });
    const linkRight = await $fetch<{ periodClicks: number }>(`/api/links/${linkId}/analytics`, {
      query: rightQuery,
      headers: { cookie },
    });
    expect(linkLeft.periodClicks).toBe(0);
    expect(linkRight.periodClicks).toBe(1);

    const wsLeft = await $fetch<{ clicks: number }>('/api/workspaces/analytics', {
      query: leftQuery,
      headers: { cookie },
    });
    const wsRight = await $fetch<{ clicks: number }>('/api/workspaces/analytics', {
      query: rightQuery,
      headers: { cookie },
    });
    expect(wsLeft.clicks).toBe(0);
    expect(wsRight.clicks).toBeGreaterThanOrEqual(1);

    const campLeft = await $fetch<{ periodClicks: number }>(`/api/campaigns/${campaignId}/analytics`, {
      query: leftQuery,
      headers: { cookie },
    });
    const campRight = await $fetch<{ periodClicks: number }>(`/api/campaigns/${campaignId}/analytics`, {
      query: rightQuery,
      headers: { cookie },
    });
    expect(campLeft.periodClicks).toBe(0);
    expect(campRight.periodClicks).toBe(1);
  });

  it('compare=previous returns null percent without prior clicks', async () => {
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-compare-empty' });
    const db = openTestDatabase(TEST_DB);
    await ensureClickEventPartitions(db, new Date('2026-09-01T00:00:00.000Z'));
    await db.insert(clickEvents).values({
      workspaceId,
      linkId,
      outcome: OUTCOME.redirect_success,
      device: DEVICE.desktop,
      browser: BROWSER.chrome,
      isBot: false,
      visitorHash: 9n,
      createdAt: new Date('2026-09-12T12:00:00.000Z'),
    });

    const cookie = await loginCookie();
    const stats = await $fetch<{
      periodClicks: number;
      previous: { clicks: number };
      change: { absolute: number; percent: number | null };
    }>(`/api/links/${linkId}/analytics`, {
      query: { from: '2026-09-10', to: '2026-09-17', compare: 'previous' },
      headers: { cookie },
    });

    expect(stats.periodClicks).toBe(1);
    expect(stats.previous.clicks).toBe(0);
    expect(stats.change.percent).toBeNull();
    expect(stats.change.absolute).toBe(1);
  });

  it('warns when from is before the oldest partition', async () => {
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-early-from' });
    const cookie = await loginCookie();
    const stats = await $fetch<{ meta: { warning?: string; earliestEventAt?: string | null } }>(
      `/api/links/${linkId}/analytics`,
      { query: { from: '2000-01-01', to: '2000-01-08' }, headers: { cookie } },
    );
    expect(stats.meta.warning).toMatch(/before the oldest retained/i);
    expect(stats.meta.earliestEventAt).toBeTruthy();
  });

  it('keeps period responses unchanged when from/to are absent', async () => {
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-period-stable' });
    for (let i = 0; i < 2; i++)
      await fetch('/an-period-stable', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });

    const cookie = await loginCookie();
    const stats = await $fetch<{
      periodClicks: number;
      meta: { timezone: string; period: string; traffic: string };
      previous?: unknown;
    }>(`/api/links/${linkId}/analytics`, { query: { period: '7d', traffic: 'human' }, headers: { cookie } });

    expect(stats.meta).toEqual({ timezone: 'UTC', period: '7d', traffic: 'human' });
    expect(stats.previous).toBeUndefined();
    expect(stats.periodClicks).toBe(2);
  });

  it('refuses period together with from/to', async () => {
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'an-refuse-both' });
    const cookie = await loginCookie();
    const res = await fetch(`/api/links/${linkId}/analytics?period=7d&from=2026-09-01&to=2026-09-08`, {
      headers: { cookie },
    });
    expect(res.status).toBe(422);
  });
});
