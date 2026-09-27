import { $fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { jobRuns, mailOutbox } from '#server/database/schema';
import { e2eSetupOptions, insertTestLink, resetTestDb, TEST_EMAIL, testDatabaseUrl, waitFor } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('jobs');
const JOBS_SECRET = 'test-jobs-secret';
const DAY_MS = 86_400_000;

type JobsResult = { sent: number; demosDeleted: number; jobs: { job: string; status: string }[] };

function runJobs() {
  return $fetch<JobsResult>('/api/jobs/alerts', {
    method: 'POST',
    headers: { authorization: `Bearer ${JOBS_SECRET}` },
  });
}

async function alertJobRow() {
  const db = openTestDatabase(TEST_DB);
  const [row] = await db.select().from(jobRuns).where(eq(jobRuns.job, 'expiry_alerts'));
  return row;
}

// A nonzero interval turns the timer on, so each job has a real due time.
describe('job runner', async () => {
  await setup(await e2eSetupOptions(TEST_DB, { NUXT_JOBS_SECRET: JOBS_SECRET, NUXT_ALERTS_INTERVAL_MINUTES: '60' }));

  let workspaceId = '';

  beforeAll(async () => {
    workspaceId = (await resetTestDb(TEST_DB)).workspaceId;
  });

  it('runs the alert job once for two concurrent calls', async () => {
    await insertTestLink(TEST_DB, { workspaceId, slug: 'job-race', expiresAt: new Date(Date.now() + DAY_MS) });

    // The boot run can take the job first. Then both calls skip. Either way,
    // at most one call runs it and one mail goes out.
    const results = await Promise.all([runJobs(), runJobs()]);
    const statuses = results.map(result => result.jobs.find(report => report.job === 'expiry_alerts')?.status);
    expect(statuses.filter(status => status === 'ran').length).toBeLessThanOrEqual(1);

    const db = openTestDatabase(TEST_DB);
    const mail = await waitFor(
      () => db.select().from(mailOutbox).where(eq(mailOutbox.to, TEST_EMAIL)),
      rows => rows.some(row => row.subject.includes('job-race')),
    );
    expect(mail.filter(row => row.subject.includes('job-race'))).toHaveLength(1);

    const first = await alertJobRow();
    expect(first?.lastSuccessAt).toBeInstanceOf(Date);
    expect(first!.nextDueAt!.getTime()).toBeGreaterThan(Date.now() + 59 * 60_000);

    // The job is not due again for an hour.
    const later = await runJobs();
    expect(later.jobs.find(report => report.job === 'expiry_alerts')?.status).toBe('skipped');
    expect((await alertJobRow())?.lastSuccessAt).toEqual(first!.lastSuccessAt);
  });
});
