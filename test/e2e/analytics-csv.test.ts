import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { clickEvents, links, workspaceMembers } from '#server/database/schema';
import { parseCsv } from '#shared/csv';
import {
  CHROME_UA,
  e2eSetupOptions,
  insertTestCampaign,
  insertTestLink,
  insertTestUser,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
  waitFor,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('analytics-csv');
const VIEWER_EMAIL = 'analytics-csv-viewer@example.com';

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

function metricValue(table: string[][], key: string) {
  const row = table.find(cells => cells[0] === key);
  return row?.[3] ?? '';
}

function seriesSum(table: string[][]) {
  const start = table.findIndex(row => row[0] === 'bucket' && row[1] === 'count');
  if (start < 0)
    return 0;
  const body: string[][] = [];
  for (const row of table.slice(start + 1)) {
    if (!row[0] || row[0] === 'section' || row[0] === 'slug')
      break;
    body.push(row);
  }
  return body.reduce((sum, row) => sum + Number(row[1] || 0), 0);
}

function sectionRows(table: string[][], section: string) {
  const start = table.findIndex(row => row[0] === 'section' && row[1] === 'label');
  if (start < 0)
    return [];
  return table.slice(start + 1).filter(row => row[0] === section);
}

describe('analytics csv download', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId = '';
  let userId = '';
  let linkId = '';
  let campaignId = '';

  beforeAll(async () => {
    ({ workspaceId, userId } = await resetTestDb(TEST_DB));
    campaignId = await insertTestCampaign(TEST_DB, {
      workspaceId,
      createdBy: userId,
      utmCampaign: 'csv-spring',
    });
    linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: userId,
      slug: 'csv-link',
      title: '=1+1',
      campaignId,
    });
    const dbSeed = openTestDatabase(TEST_DB);
    await dbSeed.update(links).set({ notes: 'secret-note-should-not-export' }).where(eq(links.id, linkId));

    await fetch('/csv-link', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    await fetch('/csv-link', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    await fetch('/csv-link', { redirect: 'manual', headers: { 'user-agent': 'Googlebot/2.1' } });

    const db = openTestDatabase(TEST_DB);
    await waitFor(
      async () => db.select().from(clickEvents).where(eq(clickEvents.linkId, linkId)),
      found => found.length >= 3,
    );

    const viewerId = await insertTestUser(TEST_DB, { email: VIEWER_EMAIL, password: TEST_PASSWORD });
    await db.insert(workspaceMembers).values({ workspaceId, userId: viewerId, role: 'viewer' });
  });

  it('matches JSON totals for link, campaign, and workspace CSV', async () => {
    const cookie = await loginCookie();

    const linkJson = await $fetch<{
      periodClicks: number;
      uniqueVisitors: number;
      botRequests: number;
      series: { bucket: string; count: number }[];
      devices: { label: string; count: number }[];
      topReferrers: { label: string; count: number }[];
    }>(`/api/links/${linkId}/analytics`, {
      query: { period: '7d', traffic: 'human' },
      headers: { cookie },
    });
    const linkCsv = await $fetch<string>(`/api/links/${linkId}/analytics.csv`, {
      query: { period: '7d', traffic: 'human' },
      headers: { cookie },
      responseType: 'text',
    });
    const linkTable = parseCsv(linkCsv);
    expect(Number(metricValue(linkTable, 'periodClicks'))).toBe(linkJson.periodClicks);
    expect(Number(metricValue(linkTable, 'uniqueVisitors'))).toBe(linkJson.uniqueVisitors);
    expect(Number(metricValue(linkTable, 'botRequests'))).toBe(linkJson.botRequests);
    expect(seriesSum(linkTable)).toBe(linkJson.periodClicks);
    expect(seriesSum(linkTable)).toBe(linkJson.series.reduce((sum, point) => sum + point.count, 0));
    expect(linkCsv).not.toContain('secret-note-should-not-export');
    expect(linkTable[0]).not.toContain('notes');
    expect(linkCsv).not.toContain('=1+1');
    expect(linkTable.some(row => row[0] === 'section' && row[1] === 'label')).toBe(true);
    if (linkJson.devices.length)
      expect(sectionRows(linkTable, 'device').length).toBeGreaterThan(0);
    if (linkJson.topReferrers.length)
      expect(sectionRows(linkTable, 'referrer').length).toBeGreaterThan(0);

    const campaignJson = await $fetch<{
      periodClicks: number;
      series: { bucket: string; count: number }[];
      bySource: { label: string; count: number }[];
      topLinks: { slug: string; title: string | null; periodClicks: number }[];
    }>(`/api/campaigns/${campaignId}/analytics`, {
      query: { period: '7d' },
      headers: { cookie },
    });
    const campaignCsv = await $fetch<string>(`/api/campaigns/${campaignId}/analytics.csv`, {
      query: { period: '7d' },
      headers: { cookie },
      responseType: 'text',
    });
    const campaignTable = parseCsv(campaignCsv);
    expect(Number(metricValue(campaignTable, 'periodClicks'))).toBe(campaignJson.periodClicks);
    expect(seriesSum(campaignTable)).toBe(campaignJson.periodClicks);
    expect(campaignTable[0]).not.toContain('notes');
    if (campaignJson.bySource.length)
      expect(sectionRows(campaignTable, 'source').length).toBeGreaterThan(0);
    const campaignTopAt = campaignTable.findIndex(row => row[0] === 'slug' && row[1] === 'title');
    expect(campaignTopAt).toBeGreaterThan(0);
    expect(campaignTable[campaignTopAt + 1]?.[0]).toBe('csv-link');
    expect(campaignCsv).not.toContain(linkId);

    const workspaceJson = await $fetch<{
      clicks: number;
      timeline: { bucket: string; count: number }[];
      topLinks: { slug: string; title: string | null; clicks: number }[];
    }>('/api/workspaces/analytics', {
      query: { period: '7d' },
      headers: { cookie },
    });
    const workspaceCsv = await $fetch<string>('/api/workspaces/analytics.csv', {
      query: { period: '7d' },
      headers: { cookie },
      responseType: 'text',
    });
    const workspaceTable = parseCsv(workspaceCsv);
    expect(Number(metricValue(workspaceTable, 'clicks'))).toBe(workspaceJson.clicks);
    expect(seriesSum(workspaceTable)).toBe(workspaceJson.clicks);
    expect(workspaceTable[0]).not.toContain('notes');
    const workspaceTopAt = workspaceTable.findIndex(row => row[0] === 'slug' && row[1] === 'title');
    expect(workspaceTopAt).toBeGreaterThan(0);
    expect(workspaceTable[workspaceTopAt + 1]?.[0]).toBe('csv-link');
    expect(workspaceTable[workspaceTopAt + 1]?.[2]).toBe(String(workspaceJson.topLinks[0]?.clicks));
    expect(workspaceCsv).not.toContain(linkId);
  });

  it('lets a viewer download workspace CSV without notes', async () => {
    const cookie = await loginCookie(VIEWER_EMAIL, TEST_PASSWORD);
    const body = await $fetch<string>('/api/workspaces/analytics.csv', {
      query: { period: '7d' },
      headers: { cookie },
      responseType: 'text',
    });
    const table = parseCsv(body);
    expect(table[0]).toEqual(['key', 'label', 'definition', 'value']);
    expect(table.some(row => row.includes('notes'))).toBe(false);
    expect(body).not.toContain('secret-note-should-not-export');
    expect(Number(metricValue(table, 'clicks'))).toBeGreaterThan(0);
    const topAt = table.findIndex(row => row[0] === 'slug' && row[1] === 'title');
    expect(topAt).toBeGreaterThan(0);
    expect(table[topAt]).toEqual(['slug', 'title', 'clicks']);
  });

  it('aligns custom range meta with the JSON report', async () => {
    const cookie = await loginCookie();
    const toDate = new Date();
    toDate.setUTCDate(toDate.getUTCDate() + 1);
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - 7);
    const from = fromDate.toISOString().slice(0, 10);
    const to = toDate.toISOString().slice(0, 10);
    const json = await $fetch<{
      periodClicks: number;
      meta: { from: string; to: string; timezone: string };
    }>(`/api/links/${linkId}/analytics`, {
      query: { from, to, compare: 'previous' },
      headers: { cookie },
    });
    const csv = await $fetch<string>(`/api/links/${linkId}/analytics.csv`, {
      query: { from, to, compare: 'previous' },
      headers: { cookie },
      responseType: 'text',
    });
    const table = parseCsv(csv);
    expect(metricValue(table, 'from')).toBe(json.meta.from);
    expect(metricValue(table, 'to')).toBe(json.meta.to);
    expect(metricValue(table, 'timezone')).toBe(json.meta.timezone);
    expect(Number(metricValue(table, 'periodClicks'))).toBe(json.periodClicks);
    expect(table.some(row => row[0] === 'previousClicks')).toBe(true);
    expect(table.some(row => row[0] === 'changeAbsolute')).toBe(true);
  });
});
