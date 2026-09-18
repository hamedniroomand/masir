import process from 'node:process';

const SENTRY_ENV_KEYS = [
  'NUXT_PUBLIC_SENTRY_DSN',
  'NUXT_PUBLIC_SENTRY_ENVIRONMENT',
  'NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE',
  'NUXT_PUBLIC_SENTRY_RELEASE',
  'SENTRY_DSN',
  'SENTRY_ENVIRONMENT',
  'SENTRY_RELEASE',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_URL',
] as const;

export function sentryEnabled(env: Record<string, string | undefined> = process.env) {
  return SENTRY_ENV_KEYS.some(name => Boolean(env[name]?.trim()));
}

export function sentryPublicEnabled(sentry: {
  dsn?: string;
  environment?: string;
  release?: string;
}) {
  return [sentry.dsn, sentry.environment, sentry.release].some(value => Boolean(value?.trim()));
}

export function sentryDsn(env: Record<string, string | undefined> = process.env) {
  return env.NUXT_PUBLIC_SENTRY_DSN?.trim() || env.SENTRY_DSN?.trim() || '';
}

export function sentryTracesSampleRate(value: unknown) {
  const rate = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(rate))
    return 1;
  return Math.min(1, Math.max(0, rate));
}
