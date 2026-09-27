import { count, eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { setMemoisedDb } from '#server/database/client';
import { CLICK_EVENT_PARTITIONS_JOB, ensureClickEventPartitions, runClickEventPartitionSweep } from '#server/database/migrate';
import { clickEvents } from '#server/database/schema';
import { registerJob, runDueJobs } from '#server/utils/jobs';
import { BROWSER, DEVICE, OUTCOME } from '#shared/codes';
import { testDatabaseUrl } from './helpers';
import { createTestDatabase, openTestDatabase, truncateTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('click-event-partitions');
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const JOB_INTERVAL_MS = 24 * HOUR_MS;

// The registry has no reset, so this file registers the real job once, the
// same way jobs-registry.test.ts registers its own test jobs. 03.alerts.ts
// wraps the sweep with getDb() the same way.
registerJob({
  name: CLICK_EVENT_PARTITIONS_JOB,
  intervalMs: JOB_INTERVAL_MS,
  run: async now => runClickEventPartitionSweep(openTestDatabase(TEST_DB), now),
});

function monthStart(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1));
}

// Every partition this file can create. A rerun against the kept-around
// database must start with none of them, because ensureClickEventPartitions
// only adds a table and never drops one.
const TEST_MONTHS = [
  'click_events_2030_12',
  ...Array.from({ length: 12 }, (_, index) => `click_events_2031_${String(index + 1).padStart(2, '0')}`),
  'click_events_2032_01',
  'click_events_2032_02',
];

async function insertEvent(createdAt: Date) {
  const db = openTestDatabase(TEST_DB);
  await db.insert(clickEvents).values({
    workspaceId: crypto.randomUUID(),
    linkId: crypto.randomUUID(),
    createdAt,
    outcome: OUTCOME.redirect_success,
    device: DEVICE.desktop,
    browser: BROWSER.chrome,
    isBot: false,
  });
  const [row] = await db.select({ n: count() }).from(clickEvents).where(eq(clickEvents.createdAt, createdAt));
  return row!.n;
}

async function partitionSet() {
  const db = openTestDatabase(TEST_DB);
  const rows = await db.execute<{ relname: string }>(sql`
    select c.relname
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    where i.inhparent = 'click_events'::regclass
    order by c.relname
  `);
  return rows.map(row => row.relname);
}

describe('click event partitions', () => {
  beforeAll(async () => {
    await createTestDatabase(TEST_DB);
    await truncateTestDatabase(TEST_DB);
    const db = openTestDatabase(TEST_DB);
    for (const name of TEST_MONTHS)
      await db.execute(sql.raw(`drop table if exists "${name}"`));
    // runDueJobs reads through getDb. Point that memo at the test database.
    setMemoisedDb(db as Parameters<typeof setMemoisedDb>[0]);
  });

  it('keeps inserts working as the clock crosses three month starts', async () => {
    for (const month of [1, 2, 3]) {
      const start = monthStart(2031, month);
      // The last daily tick before the month begins, so the insert right at
      // the boundary needs the partition the job made in advance (offset 1
      // or later), not one made after the fact.
      const now = new Date(start.getTime() - HOUR_MS);
      const reports = await runDueJobs(now);
      const report = reports.find(r => r.job === CLICK_EVENT_PARTITIONS_JOB);

      expect(report?.status).toBe('ran');
      expect(report?.count).toBe(3);
      expect(report?.detail).toEqual({ partitionsReadyThrough: monthStart(2031, month + 2) });
      expect(await insertEvent(start)).toBe(1);
    }
  });

  it('lets two runners hit the due job at once with no error and the same partitions', async () => {
    const now = new Date(monthStart(2031, 9).getTime() + DAY_MS);
    const before = await partitionSet();
    const [first, second] = await Promise.all([runDueJobs(now), runDueJobs(now)]);
    const statuses = [...first, ...second]
      .filter(r => r.job === CLICK_EVENT_PARTITIONS_JOB)
      .map(r => r.status);

    expect(statuses).toContain('ran');
    expect(statuses.filter(status => status === 'ran')).toHaveLength(1);
    expect(statuses.filter(status => status === 'skipped')).toHaveLength(1);

    const after = await partitionSet();
    expect(after).toEqual([...before, 'click_events_2031_09', 'click_events_2031_10', 'click_events_2031_11'].sort());

    for (const name of ['click_events_2031_09', 'click_events_2031_10', 'click_events_2031_11'])
      expect(await insertEvent(monthStart(2031, Number(name.slice(-2))))).toBe(1);
  });

  it('creates the same partition set when two callers race the DDL directly', async () => {
    const db = openTestDatabase(TEST_DB);
    const month = monthStart(2031, 12);
    const [namesA, namesB] = await Promise.all([
      ensureClickEventPartitions(db, month),
      ensureClickEventPartitions(db, month),
    ]);
    expect(namesA).toEqual(namesB);
    expect(namesA).toEqual(['click_events_2031_12', 'click_events_2032_01', 'click_events_2032_02']);
  });
});
