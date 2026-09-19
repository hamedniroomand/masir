import { runDemoSweep } from '#server/utils/demo';
import { runExpiryAlertSweep } from '#server/utils/link-alerts';

export default defineNitroPlugin((nitro) => {
  const { serverless, alertsIntervalMinutes, demoEnabled } = useRuntimeConfig();
  const minutes = Number(alertsIntervalMinutes) || 0;
  // A serverless instance stops between requests, so an interval there would
  // never fire. That deployment points a cron at POST /api/jobs/alerts.
  if (serverless || minutes <= 0)
    return;

  // Each sweep fails on its own. One broken sweep must not stop the other.
  const sweeps = [
    () => runExpiryAlertSweep().catch(error => console.error('[alerts] sweep failed', error)),
    ...(demoEnabled ? [() => runDemoSweep().catch(error => console.error('[demo] sweep failed', error))] : []),
  ];

  const timer = setInterval(() => {
    for (const sweep of sweeps)
      void sweep();
  }, minutes * 60_000);
  // An open timer keeps the process alive after a shutdown signal.
  timer.unref?.();

  nitro.hooks.hook('close', () => {
    clearInterval(timer);
  });
});
