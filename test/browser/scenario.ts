import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

// Each scenario is one operator's .env. A project runs its tests against a
// server started with exactly that configuration, on its own port and database.
export type Scenario = 'single';

export const SESSION_PASSWORD = '01234567890123456789012345678901';

// Two checkouts of this repository would otherwise share a port and a database,
// and one run would truncate the other's rows. MASIR_TEST_SLOT moves one aside.
// Keep it in step with scripts/stop-browser-servers.sh.
const SLOT = Number(process.env.MASIR_TEST_SLOT) || 0;

const PORTS: Record<Scenario, number> = { single: 3101 + SLOT * 10 };

function hostOf(_scenario: Scenario) {
  return 'localhost';
}

export function originOf(scenario: Scenario) {
  return `http://${hostOf(scenario)}:${PORTS[scenario]}`;
}

export function healthUrlOf(scenario: Scenario) {
  return `http://localhost:${PORTS[scenario]}/api/health`;
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
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NUXT_') && !key.startsWith('SENTRY_'))) as Record<string, string>;
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
    NUXT_ALERTS_INTERVAL_MINUTES: '0',
    // Every test signs in from one loopback address inside one minute. The
    // default of 10 refuses the eleventh test.
    NUXT_RATE_LIMIT_LOGIN_PER_MINUTE: '100',
    // Logo uploads go to a scratch directory, not into the repository. The
    // public base must name this server, or every logo points at port 3000.
    NUXT_STORAGE_LOCAL_ROOT: join(tmpdir(), 'masir-browser-uploads'),
    NUXT_STORAGE_PUBLIC_BASE_URL: `${origin}/uploads`,
  };
  return shared;
}
