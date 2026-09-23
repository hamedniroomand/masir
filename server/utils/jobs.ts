import { eq, sql } from 'drizzle-orm';
import { jobRuns } from '#server/database/schema';
import { getDb } from '#server/utils/db';

type Job = {
  name: string;
  intervalMs: number;
  // Returns how many items the job processed.
  run: () => Promise<number>;
};

export type JobReport = {
  job: string;
  status: 'ran' | 'skipped' | 'failed';
  count?: number;
  error?: string;
};

const jobs = new Map<string, Job>();

function messageOf(failure: unknown) {
  return failure instanceof Error ? failure.message : String(failure);
}

export function registerJob(job: Job) {
  jobs.set(job.name, job);
}

// The claim is a short transaction, so a pool of one connection is enough.
// ponytail: the lock lives only for the claim. A job with an interval of 0 is
// due again at once, so two calls can run it at the same time. The current
// sweeps allow that. Hold a lease (for example running_until) if a job must
// never overlap.
async function claim(job: Job, now: Date) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [lock] = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(hashtextextended(${`job:${job.name}`}, 0)) as locked`,
    );
    if (!lock?.locked)
      return false;

    // The due check runs under the lock. A second runner that gets the lock
    // after the first commits then sees the new next_due_at and skips.
    const [state] = await tx.select({ nextDueAt: jobRuns.nextDueAt }).from(jobRuns).where(eq(jobRuns.job, job.name));
    if (state?.nextDueAt && state.nextDueAt > now)
      return false;

    const values = { lastStartedAt: new Date(), nextDueAt: new Date(now.getTime() + job.intervalMs) };
    await tx.insert(jobRuns)
      .values({ job: job.name, ...values })
      .onConflictDoUpdate({ target: jobRuns.job, set: values });
    return true;
  });
}

// run() does not get the claim transaction. A rollback after a failure would
// undo the sweep's own row claims, and the next run would send the mail again.
async function runJob(job: Job, now: Date): Promise<JobReport> {
  if (!await claim(job, now))
    return { job: job.name, status: 'skipped' };

  const db = await getDb();
  try {
    const count = await job.run();
    await db.update(jobRuns).set({ lastSuccessAt: new Date() }).where(eq(jobRuns.job, job.name));
    return { job: job.name, status: 'ran', count };
  }
  catch (failure) {
    console.error(`[jobs] ${job.name} failed`, failure);
    const error = messageOf(failure);
    await db.update(jobRuns).set({ lastErrorAt: new Date(), lastError: error }).where(eq(jobRuns.job, job.name));
    return { job: job.name, status: 'failed', error };
  }
}

export async function runDueJobs(now = new Date()): Promise<JobReport[]> {
  const reports: JobReport[] = [];
  for (const job of jobs.values()) {
    // A lock or database error fails this job only. The next job still runs.
    reports.push(await runJob(job, now).catch((failure) => {
      console.error(`[jobs] ${job.name} failed`, failure);
      return { job: job.name, status: 'failed' as const, error: messageOf(failure) };
    }));
  }
  return reports;
}
