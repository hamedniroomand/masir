import { fetch, setup } from '@nuxt/test-utils';
import { eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureClickEventPartitions } from '#server/database/migrate';
import { serviceSignals } from '#server/database/schema';
import { e2eSetupOptions, insertTestLink, resetTestDb, testDatabaseUrl, waitFor } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('event-write-signal');

function currentPartitionName(now = new Date()) {
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `click_events_${now.getUTCFullYear()}_${month}`;
}

describe('event write failure signal', async () => {
  await setup(await e2eSetupOptions(TEST_DB));

  let workspaceId: string;

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    await insertTestLink(TEST_DB, {
      workspaceId,
      slug: 'signal-test',
      destinationUrl: 'https://example.com/signal-target',
    });
  });

  it('records failed signal on missing partition and recovers to ok', async () => {
    const db = openTestDatabase(TEST_DB);
    const partition = currentPartitionName();

    // Measure baseline latency with partition present
    const startNormal = performance.now();
    const resNormal = await fetch('/signal-test', { redirect: 'manual' });
    const normalLatency = performance.now() - startNormal;
    expect(resNormal.status).toBe(302);

    // Drop the current partition so subsequent event inserts fail
    await db.execute(sql.raw(`drop table if exists "${partition}"`));

    // Request redirect without the partition
    const startDegraded = performance.now();
    const resDegraded = await fetch('/signal-test', { redirect: 'manual' });
    const degradedLatency = performance.now() - startDegraded;

    expect(resDegraded.status).toBe(302);
    expect(resDegraded.headers.get('location')).toBe('https://example.com/signal-target');
    // Redirect latency must remain fast and not be blocked by event write failure
    expect(degradedLatency).toBeLessThan(Math.max(normalLatency * 3, 200));

    // Service signal should transition to 'failed'
    const signalFailed = await waitFor(
      () => db.select().from(serviceSignals).where(eq(serviceSignals.key, 'event_write')),
      rows => rows.length > 0 && rows[0]?.state === 'failed',
    );
    expect(signalFailed[0]?.state).toBe('failed');
    expect(signalFailed[0]?.detail).toHaveProperty('message');
    expect(signalFailed[0]?.detail).toHaveProperty('at');

    // Restore the partition
    await ensureClickEventPartitions(db);

    // Request redirect again; insert should succeed and restore signal to 'ok'
    const resRecovered = await fetch('/signal-test', { redirect: 'manual' });
    expect(resRecovered.status).toBe(302);

    const signalOk = await waitFor(
      () => db.select().from(serviceSignals).where(eq(serviceSignals.key, 'event_write')),
      rows => rows.length > 0 && rows[0]?.state === 'ok',
    );
    expect(signalOk[0]?.state).toBe('ok');
    expect(signalOk[0]?.detail).toHaveProperty('recoveredAt');
  });
});
