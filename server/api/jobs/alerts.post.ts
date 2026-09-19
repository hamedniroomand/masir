import { runExpiryAlertSweep } from '#server/utils/link-alerts';

export default defineEventHandler(async (event) => {
  const { jobsSecret } = useRuntimeConfig();
  // Without a secret the route does not exist, so a deployment that never set
  // one gives nothing away.
  if (!jobsSecret)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const header = getRequestHeader(event, 'authorization') ?? '';
  if (header !== `Bearer ${jobsSecret}`)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  return { sent: await runExpiryAlertSweep() };
});
