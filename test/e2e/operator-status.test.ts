import { fetch, setup } from '@nuxt/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { jobRuns, serviceSignals } from '#server/database/schema';
import {
  e2eSetupOptions,
  insertTestUser,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('operator-status');
const TEST_JOBS_SECRET = 'test-operator-secret-token';
const OPERATOR_EMAIL = 'operator@example.com';

let ownerCookie = '';
let operatorCookie = '';

async function loginCookie(email: string, password = TEST_PASSWORD) {
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

describe('operator status route', async () => {
  await setup(await e2eSetupOptions(TEST_DB, {
    NUXT_JOBS_SECRET: TEST_JOBS_SECRET,
    NUXT_OPERATOR_EMAILS: OPERATOR_EMAIL,
  }));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
    await insertTestUser(TEST_DB, { email: OPERATOR_EMAIL, password: TEST_PASSWORD });
    ownerCookie = await loginCookie(TEST_EMAIL);
    operatorCookie = await loginCookie(OPERATOR_EMAIL);
  });

  it('refuses a workspace owner who is not in NUXT_OPERATOR_EMAILS with 404', async () => {
    const res = await fetch('/api/admin/status', {
      headers: { cookie: ownerCookie },
    });
    expect(res.status).toBe(404);
  });

  it('refuses an unauthenticated request without secret with 404', async () => {
    const res = await fetch('/api/admin/status');
    expect(res.status).toBe(404);
  });

  it('refuses an invalid bearer token with 404', async () => {
    const res = await fetch('/api/admin/status', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    expect(res.status).toBe(404);
  });

  it('allows access via bearer token matching NUXT_JOBS_SECRET', async () => {
    const res = await fetch('/api/admin/status', {
      headers: { authorization: `Bearer ${TEST_JOBS_SECRET}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('jobs');
    expect(body).toHaveProperty('signals');
    expect(body).toHaveProperty('partitionsReadyThrough');
  });

  it('allows access to signed-in user whose email is in NUXT_OPERATOR_EMAILS', async () => {
    const res = await fetch('/api/admin/status', {
      headers: { cookie: operatorCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('version');
    expect(Array.isArray(body.jobs)).toBe(true);
  });

  it('reports an overdue job as failed with next action', async () => {
    const db = openTestDatabase(TEST_DB);
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    await db.insert(jobRuns).values({
      job: 'expiry_alerts',
      lastStartedAt: twoHoursAgo,
      lastSuccessAt: twoHoursAgo,
      nextDueAt: twoHoursAgo,
    }).onConflictDoUpdate({
      target: jobRuns.job,
      set: {
        lastStartedAt: twoHoursAgo,
        lastSuccessAt: twoHoursAgo,
        nextDueAt: twoHoursAgo,
      },
    });

    const res = await fetch('/api/admin/status', {
      headers: { authorization: `Bearer ${TEST_JOBS_SECRET}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      jobs: Array<{
        job: string;
        overdue: boolean;
        status: string;
        lastError: string | null;
        nextAction: string | null;
      }>;
    };

    const alertJob = body.jobs.find(j => j.job === 'expiry_alerts');
    expect(alertJob).toBeDefined();
    expect(alertJob?.overdue).toBe(true);
    expect(alertJob?.status).toBe('failed');
    expect(alertJob?.nextAction).toContain('mail');
  });

  it('never exposes secrets, connection strings, or destinations in response', async () => {
    const db = openTestDatabase(TEST_DB);
    await db.insert(serviceSignals).values({
      key: 'event_write',
      state: 'ok',
      detail: { count: 42 },
    }).onConflictDoUpdate({
      target: serviceSignals.key,
      set: { state: 'ok', detail: { count: 42 } },
    });

    const res = await fetch('/api/admin/status', {
      headers: { authorization: `Bearer ${TEST_JOBS_SECRET}` },
    });
    const text = await res.text();
    expect(text).not.toContain(TEST_JOBS_SECRET);
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('password');
  });
});
