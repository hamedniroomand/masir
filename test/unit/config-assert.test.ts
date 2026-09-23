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

  it('throws for an umami website id that is not a UUID', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: '0'.repeat(32),
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000', scripts: { umamiAnalytics: { websiteId: 'abc' } } },
    })).toThrow(/NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_WEBSITE_ID/);
  });

  it('throws for an umami host that is not an http(s) URL', () => {
    expect(() => assertRuntimeConfig({
      sessionPassword: '0'.repeat(32),
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000', scripts: { umamiAnalytics: { websiteId: '94db1cb1-74f4-4a40-ad6c-962362670409', hostUrl: 'umami.example.com' } } },
    })).toThrow(/NUXT_PUBLIC_SCRIPTS_UMAMI_ANALYTICS_HOST_URL/);
  });

  it('accepts umami cloud and self-hosted settings', () => {
    for (const hostUrl of ['', 'https://example.com/umami/']) {
      expect(() => assertRuntimeConfig({
        sessionPassword: '0'.repeat(32),
        databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
        deploymentMode: 'SELF_HOSTED' as const,
        rootDomain: 'http://localhost:3000',
        multiWorkspace: false,
        allowRegistration: false,
        public: { shortDomain: 'http://localhost:3000', scripts: { umamiAnalytics: { websiteId: '94DB1CB1-74F4-4A40-AD6C-962362670409', hostUrl } } },
      })).not.toThrow();
    }
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

  it('throws for an alerts interval that is not a whole number of minutes', () => {
    const base = {
      sessionPassword: '01234567890123456789012345678901',
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://localhost:3000',
      multiWorkspace: false,
      allowRegistration: false,
      public: { shortDomain: 'http://localhost:3000' },
    };
    expect(() => assertRuntimeConfig({ ...base, alertsIntervalMinutes: -1 })).toThrow(/NUXT_ALERTS_INTERVAL_MINUTES/);
    expect(() => assertRuntimeConfig({ ...base, alertsIntervalMinutes: 1.5 })).toThrow(/NUXT_ALERTS_INTERVAL_MINUTES/);
    expect(() => assertRuntimeConfig({ ...base, alertsIntervalMinutes: 35_001 })).toThrow(/NUXT_ALERTS_INTERVAL_MINUTES/);
    expect(() => assertRuntimeConfig({ ...base, alertsIntervalMinutes: 0 })).not.toThrow();
    expect(() => assertRuntimeConfig({ ...base, alertsIntervalMinutes: 15 })).not.toThrow();
  });

  it('refuses the demo without multi-workspace', () => {
    const base = {
      sessionPassword: '01234567890123456789012345678901',
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/x',
      deploymentMode: 'SELF_HOSTED' as const,
      rootDomain: 'http://masir.test:3000',
      allowRegistration: false,
      public: { shortDomain: 'http://masir.test:3000' },
    };
    expect(() => assertRuntimeConfig({ ...base, multiWorkspace: false, demoEnabled: true })).toThrow(/NUXT_DEMO_ENABLED/);
    expect(() => assertRuntimeConfig({ ...base, multiWorkspace: false, demoEnabled: false })).not.toThrow();
    expect(() => assertRuntimeConfig({
      ...base,
      multiWorkspace: true,
      demoEnabled: true,
      session: { cookie: { domain: '.masir.test' } },
    })).not.toThrow();
  });
});
