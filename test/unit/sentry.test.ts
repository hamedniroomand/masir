import { describe, expect, it } from 'vitest';
import { sentryDsn, sentryEnabled, sentryPublicEnabled, sentryTracesSampleRate } from '#shared/sentry';

describe('sentryEnabled', () => {
  it('is off when every Sentry variable is empty', () => {
    expect(sentryEnabled({})).toBe(false);
    expect(sentryEnabled({ NUXT_PUBLIC_SENTRY_DSN: '  ' })).toBe(false);
  });

  it('is on when any Sentry variable is set', () => {
    expect(sentryEnabled({ NUXT_PUBLIC_SENTRY_DSN: 'https://key@example/1' })).toBe(true);
    expect(sentryEnabled({ SENTRY_AUTH_TOKEN: 'token' })).toBe(true);
    expect(sentryEnabled({ SENTRY_ORG: 'acme' })).toBe(true);
  });
});

describe('sentryPublicEnabled', () => {
  it('is on when a public Sentry field is set', () => {
    expect(sentryPublicEnabled({ dsn: '', environment: '', release: '' })).toBe(false);
    expect(sentryPublicEnabled({ dsn: 'https://key@example/1' })).toBe(true);
    expect(sentryPublicEnabled({ environment: 'production' })).toBe(true);
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
  it('clamps a number to 0..1 and falls back to 1', () => {
    expect(sentryTracesSampleRate(0.2)).toBe(0.2);
    expect(sentryTracesSampleRate('0')).toBe(0);
    expect(sentryTracesSampleRate('nope')).toBe(1);
  });
});
