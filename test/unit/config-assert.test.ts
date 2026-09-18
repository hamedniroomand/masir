import { describe, expect, it } from 'vitest';
import { assertRuntimeConfig } from '#server/utils/config-assert';

describe('assertRuntimeConfig', () => {
  it('throws for short session password', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: 'short',
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000' },
    })).toThrow(/NUXT_SESSION_PASSWORD/);
  });

  it('throws for a non-postgres database url', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: '0'.repeat(32),
      databaseUrl: 'file:./data/x.db',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000' },
    })).toThrow(/NUXT_DATABASE_URL/);
  });

  it('throws for a google analytics id that is not a GA4 measurement id', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: '0'.repeat(32),
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000', scripts: { googleAnalytics: { id: 'UA-123' } } },
    })).toThrow(/NUXT_PUBLIC_SCRIPTS_GOOGLE_ANALYTICS_ID/);
  });

  it('accepts an empty google analytics id', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: '0'.repeat(32),
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000', scripts: { googleAnalytics: { id: '' } } },
    })).not.toThrow();
  });

  it('accepts an empty Sentry DSN', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: '0'.repeat(32),
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000', sentry: { dsn: '' } },
    })).not.toThrow();
  });

  it('throws for a Sentry DSN that is not an http url', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: '0'.repeat(32),
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000', sentry: { dsn: 'not-a-url' } },
    })).toThrow(/NUXT_PUBLIC_SENTRY_DSN/);
  });

  it('throws for a Sentry sample rate outside 0 to 1', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: '0'.repeat(32),
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000', sentry: { tracesSampleRate: 2 } },
    })).toThrow(/NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE/);
  });
});
