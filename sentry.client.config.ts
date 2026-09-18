import * as Sentry from '@sentry/nuxt';
import { useRuntimeConfig } from '#imports';
import { sentryPublicEnabled, sentryTracesSampleRate } from './shared/sentry';

const sentry = useRuntimeConfig().public.sentry;

Sentry.init({
  dsn: sentry.dsn?.trim() ?? '',
  enabled: sentryPublicEnabled(sentry),
  environment: sentry.environment || undefined,
  release: sentry.release || undefined,
  tracesSampleRate: sentryTracesSampleRate(sentry.tracesSampleRate),
  sendDefaultPii: false,
});
