import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { desc, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditEvents, links, mailOutbox } from '#server/database/schema';
import {
  CHROME_UA,
  e2eSetupOptions,
  insertTestLink,
  insertTestUser,
  readTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
  waitFor,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('link-alerts');
const JOBS_SECRET = 'test-jobs-secret';
const DAY_MS = 86_400_000;

let workspaceId = '';
let ownerUserId = '';
let cookie = '';

async function login() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

function mailTo(to: string) {
  const db = openTestDatabase(TEST_DB);
  return db.select().from(mailOutbox).where(eq(mailOutbox.to, to)).orderBy(desc(mailOutbox.createdAt));
}

describe('link alerts', async () => {
  // The sweep runs from the route in this file, never on a timer.
  await setup(await e2eSetupOptions(TEST_DB, { NUXT_JOBS_SECRET: JOBS_SECRET, NUXT_ALERTS_INTERVAL_MINUTES: '0' }));

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    ownerUserId = seeded.userId;
    cookie = await login();
  });

  it('sends one cap alert at the threshold and none at the cap', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: ownerUserId,
      slug: 'capped-alert',
      maximumVisits: 10,
    });

    for (let i = 0; i < 9; i++)
      await fetch('/capped-alert', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });

    const afterNine = await waitFor(() => mailTo(TEST_EMAIL), rows => rows.length >= 1);
    expect(afterNine.filter(row => row.subject.includes('capped-alert'))).toHaveLength(1);
    expect(afterNine[0]!.subject).toBe('/capped-alert reaches its visit cap soon');

    await fetch('/capped-alert', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });
    const afterTen = await mailTo(TEST_EMAIL);
    expect(afterTen.filter(row => row.subject.includes('capped-alert'))).toHaveLength(1);
    expect((await readTestLink(TEST_DB, linkId)).clickCount).toBe(10);
  });

  it('clears the sent flag when the cap rises and alerts again', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: ownerUserId,
      slug: 'raised-cap',
      maximumVisits: 10,
      clickCount: 9,
    });
    const db = openTestDatabase(TEST_DB);
    await db.update(links).set({ capAlertSentAt: new Date() }).where(eq(links.id, linkId));

    await $fetch(`/api/links/${linkId}`, { method: 'PATCH', body: { maximumVisits: 20 }, headers: { cookie } });
    expect((await readTestLink(TEST_DB, linkId)).capAlertSentAt).toBe(null);

    for (let i = 0; i < 9; i++)
      await fetch('/raised-cap', { redirect: 'manual', headers: { 'user-agent': CHROME_UA } });

    const sent = await waitFor(() => mailTo(TEST_EMAIL), rows => rows.some(row => row.subject.includes('raised-cap')));
    expect(sent.filter(row => row.subject.includes('raised-cap'))).toHaveLength(1);
  });

  it('clears the expiry flag when the expiry moves later', async () => {
    const linkId = await insertTestLink(TEST_DB, {
      workspaceId,
      createdBy: ownerUserId,
      slug: 'moved-expiry',
      expiresAt: new Date(Date.now() + DAY_MS),
    });
    const db = openTestDatabase(TEST_DB);
    await db.update(links).set({ expiryAlertSentAt: new Date() }).where(eq(links.id, linkId));

    await $fetch(`/api/links/${linkId}`, {
      method: 'PATCH',
      body: { expiresAt: Date.now() + 30 * DAY_MS },
      headers: { cookie },
    });
    expect((await readTestLink(TEST_DB, linkId)).expiryAlertSentAt).toBe(null);
  });

  it('sweeps only the links that expire soon and sends to the owner when the creator is null', async () => {
    await insertTestLink(TEST_DB, { workspaceId, slug: 'expiring-soon', expiresAt: new Date(Date.now() + 2 * DAY_MS) });
    await insertTestLink(TEST_DB, { workspaceId, slug: 'expiring-later', expiresAt: new Date(Date.now() + 5 * DAY_MS) });
    await insertTestLink(TEST_DB, { workspaceId, slug: 'off-soon', expiresAt: new Date(Date.now() + 2 * DAY_MS), isEnabled: false });
    const deleted = await insertTestLink(TEST_DB, { workspaceId, slug: 'gone-soon', expiresAt: new Date(Date.now() + 2 * DAY_MS) });
    await $fetch(`/api/links/${deleted}`, { method: 'DELETE', headers: { cookie } });

    const result = await $fetch<{ sent: number }>('/api/jobs/alerts', {
      method: 'POST',
      headers: { authorization: `Bearer ${JOBS_SECRET}` },
    });
    expect(result.sent).toBe(1);

    const sent = await mailTo(TEST_EMAIL);
    expect(sent.filter(row => row.subject.includes('expiring-soon'))).toHaveLength(1);
    expect(sent.filter(row => row.subject.includes('expiring-later'))).toHaveLength(0);
    expect(sent.filter(row => row.subject.includes('off-soon'))).toHaveLength(0);
    expect(sent.filter(row => row.subject.includes('gone-soon'))).toHaveLength(0);

    // A second sweep finds nothing, because the first one claimed the row.
    const again = await $fetch<{ sent: number }>('/api/jobs/alerts', {
      method: 'POST',
      headers: { authorization: `Bearer ${JOBS_SECRET}` },
    });
    expect(again.sent).toBe(0);

    const db = openTestDatabase(TEST_DB);
    const audit = await db.select().from(auditEvents).where(eq(auditEvents.type, 'link_alert_sent'));
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('sends one mail when two sweeps run at the same time', async () => {
    await insertTestLink(TEST_DB, { workspaceId, slug: 'race-soon', expiresAt: new Date(Date.now() + DAY_MS) });
    const sweep = () => $fetch<{ sent: number }>('/api/jobs/alerts', {
      method: 'POST',
      headers: { authorization: `Bearer ${JOBS_SECRET}` },
    });
    const [first, second] = await Promise.all([sweep(), sweep()]);
    expect(first.sent + second.sent).toBe(1);

    const sent = await mailTo(TEST_EMAIL);
    expect(sent.filter(row => row.subject.includes('race-soon'))).toHaveLength(1);
  });

  it('answers 401 without the right bearer token', async () => {
    await expect($fetch('/api/jobs/alerts', { method: 'POST' })).rejects.toMatchObject({ statusCode: 401 });
    await expect($fetch('/api/jobs/alerts', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('sends to the workspace owner when the link has no creator', async () => {
    await insertTestUser(TEST_DB, { email: 'nobody@example.com', password: TEST_PASSWORD });
    await insertTestLink(TEST_DB, { workspaceId, slug: 'no-creator', expiresAt: new Date(Date.now() + DAY_MS) });
    await $fetch('/api/jobs/alerts', { method: 'POST', headers: { authorization: `Bearer ${JOBS_SECRET}` } });
    const sent = await mailTo(TEST_EMAIL);
    expect(sent.filter(row => row.subject.includes('no-creator'))).toHaveLength(1);
  });
});
