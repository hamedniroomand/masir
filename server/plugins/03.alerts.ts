import { CLICK_EVENT_PARTITIONS_JOB, runClickEventPartitionSweep } from '#server/database/migrate';
import { getDb } from '#server/utils/db';
import { DEMO_SWEEP_JOB, runDemoSweep } from '#server/utils/demo';
import { registerJob, runDueJobs } from '#server/utils/jobs';
import { EXPIRY_ALERT_JOB, runExpiryAlertSweep } from '#server/utils/link-alerts';

// The timer checks often, so a job runs close to its due time. A tick equal to
// the job interval would miss every second run.
const TICK_MS = 60_000;
const BOOT_DELAY_MS = 30_000;
// Fixed, not the alerts interval. An instance that never restarts still needs
// next month's click_events partition ready well before it starts.
const PARTITION_INTERVAL_MS = 24 * 3_600_000;

export default defineNitroPlugin((nitro) => {
  const { serverless, alertsIntervalMinutes, demoEnabled } = useRuntimeConfig();
  const minutes = Number(alertsIntervalMinutes) || 0;
  // A serverless instance stops between requests, so an interval there would
  // never fire. That deployment points a cron at POST /api/jobs/alerts.
  const timerOn = !serverless && minutes > 0;
  // Without the timer, the cron sets the pace. Each call then runs every job.
  const intervalMs = timerOn ? minutes * 60_000 : 0;

  registerJob({ name: EXPIRY_ALERT_JOB, intervalMs, run: runExpiryAlertSweep });
  if (demoEnabled)
    registerJob({ name: DEMO_SWEEP_JOB, intervalMs, run: runDemoSweep });
  registerJob({
    name: CLICK_EVENT_PARTITIONS_JOB,
    intervalMs: PARTITION_INTERVAL_MS,
    run: async now => runClickEventPartitionSweep(await getDb(), now),
  });

  if (!timerOn)
    return;

  const tick = () => runDueJobs().catch(error => console.error('[jobs] run failed', error));
  const boot = setTimeout(tick, BOOT_DELAY_MS);
  const timer = setInterval(tick, TICK_MS);
  // An open timer keeps the process alive after a shutdown signal.
  boot.unref?.();
  timer.unref?.();

  nitro.hooks.hook('close', () => {
    clearTimeout(boot);
    clearInterval(timer);
  });
});
