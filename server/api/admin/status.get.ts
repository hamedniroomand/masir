import { newestPartitionEnd } from '#server/database/migrate';
import { jobRuns } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { getRegisteredJobInterval, listRegisteredJobNames } from '#server/utils/jobs';
import { requireOperator } from '#server/utils/operator';
import { getSignals } from '#server/utils/service-signals';
import { APP_VERSION } from '#shared/version';

const NEXT_ACTIONS: Record<string, string> = {
  expiry_alerts: 'Verify mail configuration and recipient settings.',
  demo_sweep: 'Check database permissions and demo retention settings.',
  click_event_partitions: 'Verify database DDL permissions for partition creation.',
};

const DEFAULT_NEXT_ACTION = 'Check server logs and database connectivity.';

export default defineEventHandler(async (event) => {
  await requireOperator(event);
  const db = await getDb();
  const now = new Date();

  const rows = await db.select().from(jobRuns);
  const seenJobs = new Set(rows.map(row => row.job));

  const jobs = rows.map((row) => {
    const intervalMs = getRegisteredJobInterval(row.job) ?? 15 * 60_000;
    const isOverdue = row.nextDueAt ? (now.getTime() - row.nextDueAt.getTime() > 2 * intervalMs) : false;
    const hasError = Boolean(row.lastError);
    const status = (isOverdue || hasError) ? 'failed' : 'ok';
    const lastError = row.lastError || (isOverdue ? 'Job is overdue by more than two intervals' : null);
    const nextAction = (isOverdue || hasError)
      ? (NEXT_ACTIONS[row.job] ?? DEFAULT_NEXT_ACTION)
      : null;

    return {
      job: row.job,
      lastStartedAt: row.lastStartedAt,
      lastSuccessAt: row.lastSuccessAt,
      lastErrorAt: row.lastErrorAt,
      lastError,
      nextDueAt: row.nextDueAt,
      overdue: isOverdue,
      status,
      nextAction,
    };
  });

  // Include any registered jobs that have not run yet
  for (const name of listRegisteredJobNames()) {
    if (!seenJobs.has(name)) {
      jobs.push({
        job: name,
        lastStartedAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        nextDueAt: null,
        overdue: false,
        status: 'ok',
        nextAction: null,
      });
    }
  }

  const signals = await getSignals();
  const partitionsReadyThrough = await newestPartitionEnd(db);

  return {
    version: APP_VERSION,
    jobs,
    signals,
    partitionsReadyThrough: partitionsReadyThrough ? partitionsReadyThrough.toISOString() : null,
  };
});
