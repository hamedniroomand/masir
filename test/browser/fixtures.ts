import type { Scenario } from './scenario';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import { cleanEnv, databaseUrlOf, hostUrl, originOf } from './scenario';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BRIDGE = resolve(ROOT, 'test/browser/bridge.ts');

export const OWNER_EMAIL = 'test@example.com';
export const OWNER_PASSWORD = 'test-password-12345';

function bridge<TResult>(command: string, input: Record<string, unknown>): TResult {
  const out = execFileSync('bun', ['--env-file=/dev/null', BRIDGE, command, JSON.stringify(input)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: cleanEnv(),
  });
  return JSON.parse(out.trim().split('\n').at(-1) ?? 'null') as TResult;
}

export type TestServer = {
  scenario: Scenario;
  baseURL: string;
  hostUrl: (slug: string) => string;
};

export type Db = {
  reset: () => { userId: string; workspaceId: string };
  insertUser: (input: { email: string; password: string; verified?: boolean }) => string;
  insertWorkspace: (input: { slug: string; ownerUserId: string; name?: string }) => string;
  insertLink: (input: { workspaceId: string; slug: string; destinationUrl?: string; startsAt?: string }) => string;
  lastToken: (to: string) => string | null;
};

// Worker-scoped so a beforeAll can seed with them.
type WorkerFixtures = {
  scenario: Scenario;
  server: TestServer;
  db: Db;
};

type TestFixtures = {
  login: (email?: string, password?: string) => Promise<void>;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  scenario: ['single', { scope: 'worker', option: true }],

  server: [async ({ scenario }, use) => {
    await use({ scenario, baseURL: originOf(scenario), hostUrl: slug => hostUrl(scenario, slug) });
  }, { scope: 'worker' }],

  db: [async ({ scenario }, use) => {
    const url = databaseUrlOf(scenario);
    await use({
      reset: () => bridge('reset', { url }),
      insertUser: input => bridge('insert-user', { url, ...input }),
      insertWorkspace: input => bridge('insert-workspace', { url, ...input }),
      insertLink: input => bridge('insert-link', { url, ...input }),
      lastToken: to => bridge('last-token', { url, to }),
    });
  }, { scope: 'worker' }],

  login: async ({ page }, use) => {
    await use(async (email = OWNER_EMAIL, password = OWNER_PASSWORD) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      // A wrong password stays on /login; the caller asserts that itself.
      await page.waitForURL(url => !url.pathname.startsWith('/login') || url.searchParams.has('redirect'), { timeout: 10_000 }).catch(() => {});
    });
  },
});

export { expect };
