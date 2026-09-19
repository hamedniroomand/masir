import { fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clickEvents, hosts, workspaces } from '#server/database/schema';
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
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

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

  it('sends a used-up link to its limit destination without a new click', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'one-shot',
      destinationUrl: 'https://example.com/prize',
      maximumVisits: 1,
      limitDestination: 'https://example.com/sold-out',
    });

    const first = await fetch('/one-shot', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(first.status).toBe(302);
    expect(first.headers.get('location')).toBe('https://example.com/prize');

    const second = await fetch('/one-shot', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(second.status).toBe(302);
    expect(second.headers.get('location')).toBe('https://example.com/sold-out');

    const third = await fetch('/one-shot', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(third.headers.get('location')).toBe('https://example.com/sold-out');

    const link = await readTestLink(TEST_DB, linkId);
    expect(link.clickCount).toBe(1);

    const db = openTestDatabase(TEST_DB);
    const events = await waitFor(
      () => db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId)),
      rows => rows.filter(row => row.outcome === OUTCOME.limit_redirect).length >= 2,
    );
    expect(events.filter(row => row.outcome === OUTCOME.limit_redirect).length).toBeGreaterThanOrEqual(2);
  });

  it('sends a bot on a used-up link to the limit destination and counts no click', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'bot-limit',
      destinationUrl: 'https://example.com/prize',
      maximumVisits: 1,
      clickCount: 1,
      limitDestination: 'https://example.com/sold-out',
    });
    const res = await fetch('/bot-limit', { redirect: 'manual', headers: { 'user-agent': 'Slackbot-LinkExpanding 1.0' } });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/sold-out');
    const link = await readTestLink(TEST_DB, linkId);
    expect(link.clickCount).toBe(1);
  });

  it('sends a scheduled link to its fallback and answers 404 without one', async () => {
    const soon = new Date(Date.now() + 86_400_000);
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'soon-with',
      startsAt: soon,
      scheduledDestination: 'https://example.com/coming-soon',
    });
    await insertTestLink(TEST_DB, { workspaceId, slug: 'soon-without', startsAt: soon });

    const withFallback = await fetch('/soon-with', { redirect: 'manual' });
    expect(withFallback.status).toBe(302);
    expect(withFallback.headers.get('location')).toBe('https://example.com/coming-soon');

    const withoutFallback = await fetch('/soon-without', { redirect: 'manual' });
    expect(withoutFallback.status).toBe(404);
  });

  it('picks the country rule over the os rule and keeps the utm merge', async () => {
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'targeted',
      destinationUrl: 'https://example.com/default',
      utmSource: 'poster',
      targeting: {
        os: { ios: 'https://example.com/app-store', android: 'https://example.com/play' },
        country: { DE: 'https://example.com/de' },
      },
    });

    const german = await fetch('/targeted', {
      redirect: 'manual',
      headers: { 'user-agent': IPHONE_UA, 'cf-ipcountry': 'DE' },
    });
    expect(german.status).toBe(302);
    const location = new URL(german.headers.get('location')!);
    expect(location.origin + location.pathname).toBe('https://example.com/de');
    expect(location.searchParams.get('utm_source')).toBe('poster');
  });

  it('picks the os rule when no country rule matches and falls back otherwise', async () => {
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'os-only',
      destinationUrl: 'https://example.com/default',
      targeting: { os: { ios: 'https://example.com/app-store' } },
    });

    const iphone = await fetch('/os-only', { redirect: 'manual', headers: { 'user-agent': IPHONE_UA, 'cf-ipcountry': 'US' } });
    expect(new URL(iphone.headers.get('location')!).pathname).toBe('/app-store');

    const desktop = await fetch('/os-only', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    expect(new URL(desktop.headers.get('location')!).pathname).toBe('/default');
  });

  it('gives a bot the same targeted destination', async () => {
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'bot-target',
      destinationUrl: 'https://example.com/default',
      targeting: { os: { ios: 'https://example.com/app-store' } },
    });
    const res = await fetch('/bot-target', {
      redirect: 'manual',
      headers: { 'user-agent': 'Twitterbot/1.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
    });
    expect(new URL(res.headers.get('location')!).pathname).toBe('/app-store');
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

  describe('with a link prefix', () => {
    async function setPrefix(linkPrefix: string | null) {
      const db = openTestDatabase(TEST_DB);
      await db.update(workspaces).set({ linkPrefix }).where(eq(workspaces.id, workspaceId));
    }

    beforeAll(async () => {
      await setPrefix('go');
      await insertTestLink(TEST_DB, { workspaceId, slug: 'prefixed', destinationUrl: 'https://example.com/prefixed' });
    });

    afterAll(() => setPrefix(null));

    it('redirects the prefixed path', async () => {
      const res = await fetch('/go/prefixed', { redirect: 'manual' });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://example.com/prefixed');
    });

    it('no longer answers at the root', async () => {
      const res = await fetch('/prefixed', { redirect: 'manual' });
      expect(res.status).toBe(404);
    });

    // A path the middleware skips falls through to the app, which answers
    // however it does for any unknown page. Only the destination matters here.
    it('ignores a different first segment', async () => {
      const res = await fetch('/other/prefixed', { redirect: 'manual' });
      expect(res.headers.get('location') ?? '').not.toContain('example.com');
    });

    it('ignores a third segment', async () => {
      const res = await fetch('/go/prefixed/extra', { redirect: 'manual' });
      expect(res.headers.get('location') ?? '').not.toContain('example.com');
    });
  });
});
