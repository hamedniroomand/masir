import { runExpiryAlertSweep } from '#server/utils/link-alerts';

export default defineNitroPlugin((nitro) => {
  const { serverless, alertsIntervalMinutes } = useRuntimeConfig();
  const minutes = Number(alertsIntervalMinutes) || 0;
  // A serverless instance stops between requests, so an interval there would
  // never fire. That deployment points a cron at POST /api/jobs/alerts.
  if (serverless || minutes <= 0)
    return;

  const timer = setInterval(() => {
    runExpiryAlertSweep().catch(error => console.error('[alerts] sweep failed', error));
  }, minutes * 60_000);
  // An open timer keeps the process alive after a shutdown signal.
  timer.unref?.();

  nitro.hooks.hook('close', () => {
    clearInterval(timer);
  });
});
