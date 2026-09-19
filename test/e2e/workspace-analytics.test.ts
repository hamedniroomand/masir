import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { clickEvents, workspaceMembers } from '#server/database/schema';
import { BROWSER, DEVICE, OUTCOME } from '#shared/codes';
import {
  e2eSetupOptions,
  insertTestLink,
  insertTestUser,
  insertTestWorkspace,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('workspace-analytics');
const VIEWER = 'dash-viewer@example.com';
const DAY_MS = 86_400_000;

type Summary = { id: string; slug: string };
type Dashboard = {
  clicks: number;
  uniqueVisitors: number;
  botRequests: number;
  timeline: { bucket: string; clicks?: number; count: number }[];
  topLinks: { id: string; slug: string; clicks: number }[];
  attention: { expiringSoon: Summary[]; nearCap: Summary[]; stopped: Summary[] };
};

let workspaceId = '';

async function loginCookie(email = TEST_EMAIL) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

async function click(linkId: string, targetWorkspace: string, visitor: bigint) {
  const db = openTestDatabase(TEST_DB);
  await db.insert(clickEvents).values({
    workspaceId: targetWorkspace,
    linkId,
    outcome: OUTCOME.redirect_success,
    device: DEVICE.desktop,
    browser: BROWSER.chrome,
    isBot: false,
    visitorHash: visitor,
  });
}

describe('workspace analytics', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;

    const first = await insertTestLink(TEST_DB, { workspaceId, slug: 'dash-one' });
    const second = await insertTestLink(TEST_DB, { workspaceId, slug: 'dash-two' });
    await click(first, workspaceId, 1n);
    await click(first, workspaceId, 2n);
    await click(second, workspaceId, 3n);

    // A click in another workspace must not reach this total.
    const other = await insertTestWorkspace(TEST_DB, { slug: 'other-dash', ownerUserId: seeded.userId });
    const outside = await insertTestLink(TEST_DB, { workspaceId: other, slug: 'outside' });
    await click(outside, other, 4n);

    await insertTestLink(TEST_DB, { workspaceId, slug: 'ending-soon', expiresAt: new Date(Date.now() + 3 * DAY_MS) });
    await insertTestLink(TEST_DB, { workspaceId, slug: 'ending-later', expiresAt: new Date(Date.now() + 30 * DAY_MS) });
    await insertTestLink(TEST_DB, { workspaceId, slug: 'almost-full', maximumVisits: 10, clickCount: 9 });
    await insertTestLink(TEST_DB, { workspaceId, slug: 'ended-yesterday', expiresAt: new Date(Date.now() - DAY_MS) });

    const viewerId = await insertTestUser(TEST_DB, { email: VIEWER, password: TEST_PASSWORD });
    const db = openTestDatabase(TEST_DB);
    await db.insert(workspaceMembers).values({ workspaceId, userId: viewerId, role: 'viewer' });
  });

  it('sums the clicks of the workspace and leaves another workspace out', async () => {
    const cookie = await loginCookie();
    const data = await $fetch<Dashboard>('/api/workspaces/analytics', { query: { period: '7d' }, headers: { cookie } });
    expect(data.clicks).toBe(3);
    expect(data.uniqueVisitors).toBe(3);
    expect(data.timeline.length).toBeGreaterThan(0);
  });

  it('gives at most five top links, ordered by clicks in the period', async () => {
    const cookie = await loginCookie();
    const data = await $fetch<Dashboard>('/api/workspaces/analytics', { query: { period: '7d' }, headers: { cookie } });
    expect(data.topLinks.length).toBeLessThanOrEqual(5);
    expect(data.topLinks[0]!.slug).toBe('dash-one');
    expect(data.topLinks[0]!.clicks).toBe(2);
    expect(data.topLinks.map(link => link.slug)).not.toContain('outside');
  });

  it('lists what needs attention', async () => {
    const cookie = await loginCookie();
    const { attention } = await $fetch<Dashboard>('/api/workspaces/analytics', { query: { period: '7d' }, headers: { cookie } });
    expect(attention.expiringSoon.map(link => link.slug)).toContain('ending-soon');
    expect(attention.expiringSoon.map(link => link.slug)).not.toContain('ending-later');
    expect(attention.nearCap.map(link => link.slug)).toContain('almost-full');
    expect(attention.stopped.map(link => link.slug)).toContain('ended-yesterday');
  });

  it('lets a viewer read the dashboard', async () => {
    const cookie = await loginCookie(VIEWER);
    const data = await $fetch<Dashboard>('/api/workspaces/analytics', { headers: { cookie } });
    expect(data.clicks).toBe(3);
  });
});
