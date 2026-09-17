import { fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { clickEvents, hosts } from '#server/database/schema';
import { BROWSER, DEVICE, OUTCOME } from '#shared/codes';
import {
  CHROME_UA,
  e2eSetupOptions,
  insertTestCampaign,
  insertTestLink,
  readTestLink,
  resetTestDb,
  testDatabaseUrl,
  waitFor,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('redirect');

describe('redirect middleware', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId: string;

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
  });

  it('redirects an active slug with 302', async () => {
    await insertTestLink(TEST_DB, { workspaceId, slug: 'active-test', destinationUrl: 'https://example.com/here' });
    const res = await fetch('/active-test', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/here');
  });

  it('keeps an inbound query and passes it to the destination', async () => {
    await insertTestLink(TEST_DB, { workspaceId, slug: 'query-test', destinationUrl: 'https://example.com/here?a=1' });
    const res = await fetch('/query-test?utm_source=newsletter', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/here?a=1&utm_source=newsletter');
  });

  it('applies the link and campaign utm params', async () => {
    const campaignId = await insertTestCampaign(TEST_DB, { workspaceId, utmCampaign: 'launch', utmMedium: 'social' });
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'utm-test',
      destinationUrl: 'https://example.com/here',
      campaignId,
      utmSource: 'twitter',
    });
    const res = await fetch('/utm-test', { redirect: 'manual' });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('utm_source')).toBe('twitter');
    expect(location.searchParams.get('utm_medium')).toBe('social');
    expect(location.searchParams.get('utm_campaign')).toBe('launch');
  });

  it('lets an inbound utm param override the stored one', async () => {
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'override-test',
      destinationUrl: 'https://example.com/here',
      utmSource: 'twitter',
    });
    const res = await fetch('/override-test?utm_source=email', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/here?utm_source=email');
  });

  it('returns 404 with disabled linkState', async () => {
    await insertTestLink(TEST_DB, { workspaceId, slug: 'off-test', isEnabled: false });
    const res = await fetch('/off-test', { headers: { accept: 'application/json' } });
    expect(res.status).toBe(404);
    const body = await res.json() as { data?: { linkState?: string } };
    expect(body.data?.linkState).toBe('disabled');
  });

  it('returns 404 with expired linkState', async () => {
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'old-test',
      expiresAt: new Date(Date.now() - 60_000),
    });
    const res = await fetch('/old-test', { headers: { accept: 'application/json' } });
    expect(res.status).toBe(404);
    const body = await res.json() as { data?: { linkState?: string } };
    expect(body.data?.linkState).toBe('expired');
  });

  it('does not handle /login', async () => {
    const res = await fetch('/login');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('stores one hosts row for a repeated referrer and integer codes on the event', async () => {
    const db = openTestDatabase(TEST_DB);
    const referer = 'https://news.example.test/story';
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'referred' });

    for (let i = 0; i < 2; i++) {
      await fetch('/referred', {
        redirect: 'manual',
        headers: { 'user-agent': CHROME_UA, referer },
      });
    }

    const events = await waitFor(
      () => db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId)),
      rows => rows.length >= 2,
    );
    expect(events).toHaveLength(2);

    const hostRows = await db.select().from(hosts).where(eq(hosts.host, 'news.example.test'));
    expect(hostRows).toHaveLength(1);

    const stored = events[0]!;
    expect(stored.outcome).toBe(OUTCOME.redirect_success);
    expect(stored.device).toBe(DEVICE.desktop);
    expect(stored.browser).toBe(BROWSER.chrome);
    expect(stored.referrerHost).toBe(hostRows[0]!.id);
    expect(typeof stored.visitorHash).toBe('bigint');
    expect(stored.botCategory).toBeNull();
  });

  it('does not raise the counter for a bot', async () => {
    const db = openTestDatabase(TEST_DB);
    const linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'bot-counted' });
    await fetch('/bot-counted', {
      redirect: 'manual',
      headers: { 'user-agent': 'Googlebot/2.1' },
    });

    await waitFor(
      () => db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId)),
      rows => rows.length >= 1,
    );
    const row = await readTestLink(TEST_DB, linkId);
    expect(row.clickCount).toBe(0);
  });
});
