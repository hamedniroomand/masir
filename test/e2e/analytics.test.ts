import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { clickEvents, links } from '#server/database/schema';
import {
  CHROME_UA,
  e2eSetupOptions,
  insertTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabasePath,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabasePath('analytics');

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
  await setup(e2eSetupOptions(TEST_DB));

  let userId = '';

  beforeAll(async () => {
    ({ userId } = await resetTestDb(TEST_DB));
  });

  it('records outcomes for blocked paths and bot traffic', async () => {
    const disabledId = await insertTestLink(TEST_DB, { userId, slug: 'an-disabled', isEnabled: false });
    await fetch('/an-disabled', { headers: { 'accept': 'application/json', 'user-agent': CHROME_UA } });

    const scheduledId = await insertTestLink(TEST_DB, {
      userId,
      slug: 'an-scheduled',
      startsAt: new Date(Date.now() + 86400_000),
    });
    await fetch('/an-scheduled', { headers: { 'accept': 'application/json', 'user-agent': CHROME_UA } });

    const expiredId = await insertTestLink(TEST_DB, {
      userId,
      slug: 'an-expired',
      expiresAt: new Date(Date.now() - 1000),
    });
    await fetch('/an-expired', { headers: { 'accept': 'application/json', 'user-agent': CHROME_UA } });

    const botId = await insertTestLink(TEST_DB, { userId, slug: 'an-bot' });
    await fetch('/an-bot', { redirect: 'manual', headers: { 'user-agent': 'Googlebot/2.1' } });

    const db = openTestDatabase(TEST_DB);
    const outcomes = async (linkId: string) => {
      const rows = await db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId));
      return rows.map(r => r.outcome);
    };

    expect(await outcomes(disabledId)).toContain('disabled_block');
    expect(await outcomes(scheduledId)).toContain('scheduled_block');
    expect(await outcomes(expiredId)).toContain('expired_block');
    expect(await outcomes(botId)).toContain('bot_request');

    const botLink = await db.select().from(links).where(eq(links.id, botId)).limit(1);
    expect(botLink[0]?.clickCount).toBe(0);
  });

  it('counts unique visitors without storing raw IP', async () => {
    const linkId = await insertTestLink(TEST_DB, { userId, slug: 'an-unique' });
    for (let i = 0; i < 5; i++) {
      await fetch('/an-unique', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    }

    const cookie = await loginCookie();
    const stats = await $fetch<{
      totalClicks: number;
      uniqueVisitors: number;
      periodClicks: number;
    }>(`/api/links/${linkId}/analytics`, { query: { period: '24h' }, headers: { cookie } });

    expect(stats.totalClicks).toBe(5);
    expect(stats.uniqueVisitors).toBe(1);

    const db = openTestDatabase(TEST_DB);
    const rows = await db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId));
    expect(rows.every(r => !String(r.referrerHost).includes('127.0.0.1'))).toBe(true);
    expect(rows.every(r => r.visitorHash != null)).toBe(true);
  });

  it('filters chart traffic by classification', async () => {
    const linkId = await insertTestLink(TEST_DB, { userId, slug: 'an-traffic' });
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
});
