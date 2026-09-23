import { $fetch, setup } from '@nuxt/test-utils';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { e2eSetupOptions, resetTestDb, testDatabaseUrl } from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('jobs-failure');
const JOBS_SECRET = 'test-jobs-secret';

function runJobs() {
  return $fetch('/api/jobs/alerts', {
    method: 'POST',
    headers: { authorization: `Bearer ${JOBS_SECRET}` },
  });
}

// The docs advise a pool of one on serverless. A job must not wait for a
// second connection.
describe('job route with a pool of one', async () => {
  await setup(await e2eSetupOptions(TEST_DB, { NUXT_JOBS_SECRET: JOBS_SECRET, NUXT_DATABASE_POOL_MAX: '1' }));

  beforeAll(async () => {
    await resetTestDb(TEST_DB);
  });

  it('runs the jobs', async () => {
    expect(await runJobs()).toMatchObject({ sent: 0, demosDeleted: 0, jobs: [{ job: 'expiry-alerts', status: 'ran' }] });
  });

  it('answers 500 with the job reports when a job fails', async () => {
    const db = openTestDatabase(TEST_DB);
    // A missing column makes the sweep query fail.
    await db.execute(sql`alter table links rename column expiry_alert_sent_at to expiry_alert_sent_at_off`);
    try {
      const failure = await runJobs().catch(error => error);
      expect(failure).toMatchObject({
        statusCode: 500,
        data: { data: { jobs: [{ job: 'expiry-alerts', status: 'failed' }] } },
      });
    }
    finally {
      await db.execute(sql`alter table links rename column expiry_alert_sent_at_off to expiry_alert_sent_at`);
    }
  });
});
