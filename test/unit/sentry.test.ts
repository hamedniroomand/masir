import { describe, expect, it } from 'vitest';
import { sentryCompiled, sentryDsn, sentryEnabled, sentryPublicEnabled, sentryTracesSampleRate } from '#shared/sentry';

describe('sentryEnabled', () => {
  it('is off without a DSN', () => {
    expect(sentryEnabled({})).toBe(false);
    expect(sentryEnabled({ NUXT_PUBLIC_SENTRY_DSN: '  ' })).toBe(false);
    // The container reads these at run time to upload source maps. They send
    // no events, so they must not start the SDK on their own.
    expect(sentryEnabled({ SENTRY_AUTH_TOKEN: 'token', SENTRY_ORG: 'acme' })).toBe(false);
    expect(sentryEnabled({ NUXT_PUBLIC_SENTRY_RELEASE: 'masir@1.0.1' })).toBe(false);
  });

  it('is on for either DSN variable', () => {
    expect(sentryEnabled({ NUXT_PUBLIC_SENTRY_DSN: 'https://key@example/1' })).toBe(true);
    expect(sentryEnabled({ SENTRY_DSN: 'https://key@example/1' })).toBe(true);
  });
});

describe('sentryCompiled', () => {
  it('compiles the module in for any Sentry variable or the build flag alone', () => {
    expect(sentryCompiled({})).toBe(false);
    expect(sentryCompiled({ SENTRY_BUILD: 'true' })).toBe(true);
    expect(sentryCompiled({ SENTRY_BUILD: 'false' })).toBe(false);
    expect(sentryCompiled({ NUXT_PUBLIC_SENTRY_DSN: 'https://key@example/1' })).toBe(true);
    expect(sentryCompiled({ SENTRY_AUTH_TOKEN: 'token' })).toBe(true);
  });
});

describe('sentryPublicEnabled', () => {
  it('follows the DSN alone', () => {
    expect(sentryPublicEnabled({ dsn: '' })).toBe(false);
    expect(sentryPublicEnabled({ dsn: 'https://key@example/1' })).toBe(true);
  });
});

describe('sentryDsn', () => {
  it('prefers the public DSN', () => {
    expect(sentryDsn({
      NUXT_PUBLIC_SENTRY_DSN: 'https://a@example/1',
      SENTRY_DSN: 'https://b@example/2',
    })).toBe('https://a@example/1');
  });
});

describe('sentryTracesSampleRate', () => {
  it('clamps a number to 0..1 and falls back to 0', () => {
    expect(sentryTracesSampleRate(0.2)).toBe(0.2);
    expect(sentryTracesSampleRate('0')).toBe(0);
    expect(sentryTracesSampleRate('nope')).toBe(0);
    expect(sentryTracesSampleRate(undefined)).toBe(0);
  });
});
