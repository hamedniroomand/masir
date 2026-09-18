import process from 'node:process';
import * as Sentry from '@sentry/nuxt';
import { sentryDsn, sentryEnabled, sentryTracesSampleRate } from './shared/sentry';

Sentry.init({
  dsn: sentryDsn(),
  enabled: sentryEnabled(),
  environment: process.env.NUXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.SENTRY_ENVIRONMENT || undefined,
  release: process.env.NUXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE || undefined,
  tracesSampleRate: sentryTracesSampleRate(
    process.env.NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? process.env.SENTRY_TRACES_SAMPLE_RATE,
  ),
  sendDefaultPii: false,
});
