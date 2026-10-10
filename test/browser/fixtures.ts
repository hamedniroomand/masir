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

export type LinkSeed = {
  workspaceId: string;
  slug: string;
  createdBy?: string;
  title?: string;
  destinationUrl?: string;
  startsAt?: string;
  expiresAt?: string;
  isEnabled?: boolean;
  password?: string;
  maximumVisits?: number;
  expirationDestination?: string;
  clickCount?: number;
  campaignId?: string;
  utmSource?: string;
  tags?: string[];
};

export type ClickSeed = {
  workspaceId: string;
  linkId: string;
  count?: number;
  outcome?: 'redirect_success' | 'bot_request' | 'password_failed';
  device?: 'desktop' | 'mobile' | 'tablet' | 'other';
  browser?: 'chrome' | 'firefox' | 'safari' | 'edge' | 'other';
  country?: string;
  referrer?: string;
  visitor?: number;
  minutesAgo?: number;
};

export type Db = {
  reset: () => { userId: string; workspaceId: string };
  insertUser: (input: { email: string; password: string; verified?: boolean }) => string;
  insertWorkspace: (input: { slug: string; ownerUserId: string; name?: string }) => string;
  insertLink: (input: LinkSeed) => string;
  insertLinks: (input: Omit<LinkSeed, 'slug'> & { slugs: string[] }) => string[];
  insertCampaign: (input: { workspaceId: string; utmCampaign: string; name?: string }) => string;
  insertMember: (input: { workspaceId: string; userId: string; role?: 'owner' | 'member' | 'viewer'; deactivated?: boolean }) => void;
  insertIdentity: (input: { userId: string; provider?: 'google' | 'microsoft' }) => void;
  insertClicks: (input: ClickSeed) => void;
  lastToken: (to: string) => string | null;
  mailCount: (to: string) => number;
};

// Worker-scoped so a beforeAll can seed with them.
type WorkerFixtures = {
  scenario: Scenario;
  server: TestServer;
  db: Db;
};

type TestFixtures = {
  login: (email?: string, password?: string, options?: { allowFailure?: boolean }) => Promise<void>;
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
      insertLinks: input => bridge('insert-links', { url, ...input }),
      insertCampaign: input => bridge('insert-campaign', { url, ...input }),
      insertMember: input => bridge('insert-member', { url, ...input }),
      insertIdentity: input => bridge('insert-identity', { url, ...input }),
      insertClicks: input => bridge('insert-clicks', { url, ...input }),
      lastToken: to => bridge('last-token', { url, to }),
      mailCount: to => bridge('mail-count', { url, to }),
    });
  }, { scope: 'worker' }],

  login: async ({ page }, use) => {
    await use(async (email = OWNER_EMAIL, password = OWNER_PASSWORD, options = {}) => {
      await page.goto('/login');
      // With a sign-in provider configured the password form hides behind a link.
      // The page renders on the client, so wait for one of the two before the
      // choice, or a cold server reads as "no link" and the form never fills.
      const emailLink = page.getByRole('button', { name: 'Sign in with email instead' });
      await expect(emailLink.or(page.getByLabel('Password'))).toBeVisible();
      if (await emailLink.isVisible())
        await emailLink.click();
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      // A sign-in that never leaves /login is an error, unless the caller tests
      // exactly that. Report it here, not as a timeout in a later step.
      const left = page.waitForURL(url => !url.pathname.startsWith('/login') || url.searchParams.has('redirect'), { timeout: 10_000 });
      if (options.allowFailure)
        await left.catch(() => {});
      else
        await left;
    });
  },
});

export { expect };
