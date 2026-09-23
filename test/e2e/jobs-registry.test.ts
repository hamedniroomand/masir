import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { setMemoisedDb } from '#server/database/client';
import { jobRuns } from '#server/database/schema';
import { registerJob, runDueJobs } from '#server/utils/jobs';
import { testDatabaseUrl } from './helpers';
import { createTestDatabase, openTestDatabase, truncateTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('jobs-registry');
const HOUR_MS = 3_600_000;

let healthyRuns = 0;

// The registry has no reset, so this file registers its jobs once.
registerJob({ name: 'test-broken', intervalMs: HOUR_MS, run: async () => {
  throw new Error('broken on purpose');
} });
// The delay keeps the job running while a second runner starts.
registerJob({ name: 'test-healthy', intervalMs: HOUR_MS, run: async () => {
  await new Promise(done => setTimeout(done, 100));
  return ++healthyRuns;
} });

async function rowOf(job: string) {
  const db = openTestDatabase(TEST_DB);
  const [row] = await db.select().from(jobRuns).where(eq(jobRuns.job, job));
  return row;
}

describe('job registry', () => {
  beforeAll(async () => {
    await createTestDatabase(TEST_DB);
    await truncateTestDatabase(TEST_DB);
    // runDueJobs reads through getDb. Point that memo at the test database.
    setMemoisedDb(openTestDatabase(TEST_DB) as Parameters<typeof setMemoisedDb>[0]);
  });

  it('records a failed job and still runs the next one', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const now = new Date();
    const reports = await runDueJobs(now);
    logged.mockRestore();

    expect(reports).toEqual([
      { job: 'test-broken', status: 'failed', error: 'broken on purpose' },
      { job: 'test-healthy', status: 'ran', count: 1 },
    ]);
    const broken = await rowOf('test-broken');
    expect(broken).toMatchObject({ lastError: 'broken on purpose', lastSuccessAt: null });
    expect(broken?.lastErrorAt).toBeInstanceOf(Date);
    expect(broken?.nextDueAt?.getTime()).toBe(now.getTime() + HOUR_MS);
    expect((await rowOf('test-healthy'))?.lastSuccessAt).toBeInstanceOf(Date);
  });

  it('skips a job until it is due', async () => {
    const soon = await runDueJobs(new Date(Date.now() + 60_000));
    expect(soon.map(report => report.status)).toEqual(['skipped', 'skipped']);

    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const due = await runDueJobs(new Date(Date.now() + 2 * HOUR_MS));
    logged.mockRestore();
    expect(due.map(report => report.status)).toEqual(['failed', 'ran']);
    expect(healthyRuns).toBe(2);
  });

  it('runs a job once for two concurrent runners', async () => {
    const now = new Date(Date.now() + 4 * HOUR_MS);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reports = (await Promise.all([runDueJobs(now), runDueJobs(now)])).flat();
    logged.mockRestore();

    for (const job of ['test-broken', 'test-healthy'])
      expect(reports.filter(report => report.job === job && report.status !== 'skipped')).toHaveLength(1);
    expect(healthyRuns).toBe(3);
  });
});
