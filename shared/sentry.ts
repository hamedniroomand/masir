import process from 'node:process';

// Every Sentry variable, runtime and upload. One of them present at build
// compiles the module in, because a later build is not always possible.
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

export function sentryDsn(env: Record<string, string | undefined> = process.env) {
  return env.NUXT_PUBLIC_SENTRY_DSN?.trim() || env.SENTRY_DSN?.trim() || '';
}

// Only the DSN starts the SDK. The upload variables send no events, and the
// image reads them at run time, so they must not start it on their own.
export function sentryEnabled(env: Record<string, string | undefined> = process.env) {
  return Boolean(sentryDsn(env));
}

// The Docker build sets SENTRY_BUILD, so the module is compiled in and an
// operator turns Sentry on later with runtime variables alone.
export function sentryCompiled(env: Record<string, string | undefined> = process.env) {
  return env.SENTRY_BUILD === 'true' || SENTRY_ENV_KEYS.some(name => Boolean(env[name]?.trim()));
}

export function sentryPublicEnabled(sentry: { dsn?: string }) {
  return Boolean(sentry.dsn?.trim());
}

export function sentryTracesSampleRate(value: unknown) {
  const rate = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(rate))
    return 0;
  return Math.min(1, Math.max(0, rate));
}
