import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

// Each scenario is one operator's .env. A project runs its tests against a
// server started with exactly that configuration, on its own port and database.
export type Scenario = 'single' | 'multi' | 'cloud';

export const SESSION_PASSWORD = '01234567890123456789012345678901';

// Two checkouts of this repository would otherwise share a port and a database,
// and one run would truncate the other's rows. MASIR_TEST_SLOT moves one aside.
// Keep it in step with scripts/stop-browser-servers.sh.
const SLOT = Number(process.env.MASIR_TEST_SLOT) || 0;

const PORTS: Record<Scenario, number> = { single: 3101 + SLOT * 10, multi: 3102 + SLOT * 10, cloud: 3103 + SLOT * 10 };

// Chromium stores a cookie for `localhost` as host-only and ignores a Domain
// of `.localhost`, so a session set on the root host never reaches
// `acme.localhost`. The multi-workspace scenarios use a dotted name instead,
// which playwright.config maps onto loopback inside the browser.
export const TEST_DOMAIN = 'masir.test';

function hostOf(scenario: Scenario) {
  return scenario === 'single' ? 'localhost' : TEST_DOMAIN;
}

export function originOf(scenario: Scenario) {
  return `http://${hostOf(scenario)}:${PORTS[scenario]}`;
}

// Node resolves nothing under masir.test, so readiness checks use localhost.
export function healthUrlOf(scenario: Scenario) {
  return `http://localhost:${PORTS[scenario]}/api/health`;
}

export function hostUrl(scenario: Scenario, slug: string) {
  return `http://${slug}.${hostOf(scenario)}:${PORTS[scenario]}`;
}

export function databaseUrlOf(scenario: Scenario) {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgres://masir:masir@127.0.0.1:5432/masir_test');
  url.pathname = `/masir_test_browser_${scenario}${SLOT ? `_${SLOT}` : ''}`;
  return url.toString();
}

// Bun loads the repository .env into every process it starts. Nothing from it
// may reach a test server or the bridge, so both run with --env-file=/dev/null
// and an environment without NUXT_ values.
export function cleanEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NUXT_'))) as Record<string, string>;
}

export function serverEnv(scenario: Scenario): Record<string, string> {
  const origin = originOf(scenario);
  const shared = {
    PORT: String(PORTS[scenario]),
    NODE_ENV: 'production',
    NUXT_SESSION_PASSWORD: SESSION_PASSWORD,
    NUXT_DATABASE_URL: databaseUrlOf(scenario),
    NUXT_DATABASE_POOL_MAX: '2',
    NUXT_ROOT_DOMAIN: origin,
    NUXT_PUBLIC_SHORT_DOMAIN: origin,
    NUXT_MAIL_DRIVER: 'outbox',
    // Every test signs in from one loopback address inside one minute. The
    // default of 10 refuses the eleventh test.
    NUXT_RATE_LIMIT_LOGIN_PER_MINUTE: '100',
    // Logo uploads go to a scratch directory, not into the repository.
    NUXT_STORAGE_LOCAL_ROOT: join(tmpdir(), 'masir-browser-uploads'),
  };
  const multi = {
    NUXT_MULTI_WORKSPACE: 'true',
    NUXT_SESSION_COOKIE_DOMAIN: `.${TEST_DOMAIN}`,
    // Chromium accepts a Secure cookie from http://localhost but not from
    // http://masir.test.
    NUXT_SESSION_COOKIE_SECURE: 'false',
    NUXT_ALLOW_REGISTRATION: 'true',
  };
  switch (scenario) {
    case 'single':
      return { ...shared, NUXT_DEPLOYMENT_MODE: 'SELF_HOSTED', NUXT_MULTI_WORKSPACE: 'false', NUXT_ALLOW_REGISTRATION: 'false' };
    case 'multi':
      return { ...shared, ...multi, NUXT_DEPLOYMENT_MODE: 'SELF_HOSTED' };
    case 'cloud':
      return {
        ...shared,
        ...multi,
        NUXT_DEPLOYMENT_MODE: 'CLOUD',
        // CLOUD refuses disk storage, so a bucket must be named. Nothing uploads.
        NUXT_STORAGE_BUCKET: 'test-bucket',
        NUXT_STORAGE_ACCESS_KEY_ID: 'test',
        NUXT_STORAGE_SECRET_ACCESS_KEY: 'test',
        NUXT_STORAGE_ENDPOINT: 'http://127.0.0.1:9',
        NUXT_OAUTH_GOOGLE_CLIENT_ID: 'test-client',
        NUXT_OAUTH_GOOGLE_CLIENT_SECRET: 'test-secret',
      };
  }
}
