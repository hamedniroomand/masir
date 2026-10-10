import type { Scenario } from './test/browser/scenario';
import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';
import { cleanEnv, databaseUrlOf, healthUrlOf, originOf, serverEnv, TEST_DOMAIN } from './test/browser/scenario';

const SCENARIOS: Scenario[] = ['single', 'multi', 'cloud'];

// The server migrates on boot but cannot create its database, so the bridge
// makes it first.
function serveCommand(scenario: Scenario) {
  const create = JSON.stringify({ url: databaseUrlOf(scenario) });
  return `bun --env-file=/dev/null test/browser/bridge.ts create-db '${create}' && bun --env-file=/dev/null .output/server/index.mjs`;
}

// The tests run against a production build, never the dev server. `bun run
// test:browser` builds first; `bun run test:browser:run` reuses the last build,
// or a server that already listens on the port.
export default defineConfig<{ scenario: Scenario }>({
  testDir: 'test/browser',
  // Every project shares one database per scenario, so its files run in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  // Three servers and a browser share one machine, and the pages fetch their
  // data after they load. The 5s default reads that as a missing element.
  expect: { timeout: 10_000 },
  use: {
    ...devices['Desktop Chrome'],
    // Taller than the 720 of Desktop Chrome. A date popover on a long settings
    // page puts its buttons below that fold, where a click never lands.
    viewport: { width: 1280, height: 1024 },
    trace: 'on-first-retry',
    // See TEST_DOMAIN: the multi-workspace hosts resolve inside Chromium only.
    launchOptions: { args: [`--host-resolver-rules=MAP *.${TEST_DOMAIN} 127.0.0.1, MAP ${TEST_DOMAIN} 127.0.0.1`] },
  },
  projects: SCENARIOS.map(scenario => ({
    name: scenario,
    testDir: `test/browser/${scenario}`,
    use: { scenario, baseURL: originOf(scenario) },
  })),
  webServer: SCENARIOS.map(scenario => ({
    command: serveCommand(scenario),
    url: healthUrlOf(scenario),
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { ...cleanEnv(), ...serverEnv(scenario) },
  })),
});
