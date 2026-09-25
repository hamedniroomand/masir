import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { DEMO_SWEEP_JOB } from '#server/utils/demo';
import { runDueJobs } from '#server/utils/jobs';
import { EXPIRY_ALERT_JOB } from '#server/utils/link-alerts';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';

function tokenMatches(header: string, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  // A length mismatch is answered without the comparison, so the time it takes
  // says nothing about where the two strings differ.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  // Without a secret the route does not exist, so a deployment that never set
  // one gives nothing away.
  if (!config.jobsSecret)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  // The same budget as sign-in, so nobody can guess the token at speed.
  const clientKey = await hashClientKey(event);
  const rl = await rateLimitCheck(`jobs:${clientKey}`, Number(config.rateLimitLoginPerMinute) || 10, 60_000);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  const header = getRequestHeader(event, 'authorization') ?? '';
  if (!tokenMatches(header, config.jobsSecret))
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const jobs = await runDueJobs();
  const countOf = (name: string) => jobs.find(report => report.job === name)?.count ?? 0;
  const result = { sent: countOf(EXPIRY_ALERT_JOB), demosDeleted: countOf(DEMO_SWEEP_JOB), jobs };
  // A cron monitor watches the status. A failed job still answers 500, as a
  // failed sweep did before, after every other job ran.
  if (jobs.some(report => report.status === 'failed'))
    throw createError({ statusCode: 500, statusMessage: 'Job failed', data: result });
  return result;
});
