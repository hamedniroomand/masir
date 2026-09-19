import { eq } from 'drizzle-orm';
import { authIdentities, campaigns, links, users, workspaceMembers, workspaces } from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
import { createTestDatabase, openTestDatabase, truncateTestDatabase } from './test-db';
import { startTestServer } from './test-server';

export { testDatabaseUrl } from './test-db';

const sharedEnv = {
  NUXT_SESSION_PASSWORD: '01234567890123456789012345678901',
  NUXT_PUBLIC_SHORT_DOMAIN: 'http://127.0.0.1:3000',
  NUXT_ALLOW_REGISTRATION: 'true',
  NUXT_MAIL_DRIVER: 'outbox',
  // A test file signs in once for each case. The default of 10 refuses the
  // eleventh. rate-limit.test.ts sets its own value and is not affected.
  NUXT_RATE_LIMIT_LOGIN_PER_MINUTE: '200',
  // Test files run together. A pool of 10 for each would exhaust Postgres.
  NUXT_DATABASE_POOL_MAX: '2',
};

// The Nuxt server migrates on boot, so the database must exist before setup().
export async function e2eSetupOptions(databaseUrl: string, env: Record<string, string> = {}) {
  await createTestDatabase(databaseUrl);
  const host = await startTestServer({ ...sharedEnv, NUXT_DATABASE_URL: databaseUrl, ...env });
  // host makes setup() skip the build and the server. It only points the test
  // helpers at the server this file started.
  return { host, runner: 'vitest' as const };
}

// The redirect records its event with waitUntil, so the response returns before
// the row lands. Poll instead of reading once.
export async function waitFor<T>(read: () => Promise<T>, ready: (value: T) => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!ready(value) && Date.now() < deadline) {
    await new Promise(done => setTimeout(done, 50));
    value = await read();
  }
  return value;
}

export const TEST_EMAIL = 'test@example.com';
export const TEST_PASSWORD = 'test-password-12345';
export const TEST_WORKSPACE_SLUG = 'acme';

export async function insertTestUser(databaseUrl: string, input: {
  email: string;
  password: string;
  verified?: boolean;
}) {
  const db = openTestDatabase(databaseUrl);
  const [user] = await db.insert(users).values({
    email: input.email,
    emailVerifiedAt: input.verified === false ? null : new Date(),
    firstName: 'Test',
    lastName: 'User',
  }).returning();
  await db.insert(authIdentities).values({
    userId: user!.id,
    provider: 'password',
    providerAccountId: user!.id,
    passwordHash: await hashSecret(input.password),
  });
  return user!.id;
}

export async function resetTestDb(databaseUrl: string) {
  await truncateTestDatabase(databaseUrl);
  const db = openTestDatabase(databaseUrl);
  const userId = await insertTestUser(databaseUrl, { email: TEST_EMAIL, password: TEST_PASSWORD });
  const workspaceId = await insertTestWorkspace(databaseUrl, {
    slug: TEST_WORKSPACE_SLUG,
    name: 'Acme',
    ownerUserId: userId,
  });
  return { db, userId, workspaceId };
}

export async function insertTestWorkspace(databaseUrl: string, input: {
  slug: string;
  name?: string;
  ownerUserId: string;
}) {
  const db = openTestDatabase(databaseUrl);
  const [workspace] = await db.insert(workspaces).values({
    name: input.name ?? input.slug,
    slug: input.slug,
  }).returning();
  await db.insert(workspaceMembers).values({
    workspaceId: workspace!.id,
    userId: input.ownerUserId,
    role: 'owner',
  });
  return workspace!.id;
}

export async function insertTestCampaign(databaseUrl: string, input: {
  workspaceId: string;
  createdBy?: string;
  name?: string;
  utmCampaign: string;
  utmMedium?: string | null;
}) {
  const db = openTestDatabase(databaseUrl);
  const [campaign] = await db.insert(campaigns).values({
    workspaceId: input.workspaceId,
    createdBy: input.createdBy ?? null,
    name: input.name ?? input.utmCampaign,
    utmCampaign: input.utmCampaign,
    utmMedium: input.utmMedium ?? null,
  }).returning();
  return campaign!.id;
}

export async function insertTestLink(databaseUrl: string, input: {
  workspaceId: string;
  createdBy?: string;
  slug: string;
  title?: string;
  destinationUrl?: string;
  isEnabled?: boolean;
  expiresAt?: Date | null;
  campaignId?: string | null;
  utmSource?: string | null;
  utmContent?: string | null;
  passwordHash?: string | null;
  startsAt?: Date | null;
  expirationDestination?: string | null;
  limitDestination?: string | null;
  scheduledDestination?: string | null;
  maximumVisits?: number | null;
  clickCount?: number;
}) {
  const db = openTestDatabase(databaseUrl);
  const [link] = await db.insert(links).values({
    workspaceId: input.workspaceId,
    createdBy: input.createdBy ?? null,
    slug: input.slug,
    title: input.title ?? null,
    destinationUrl: input.destinationUrl ?? 'https://example.com/target',
    destinationHost: 'example.com',
    isEnabled: input.isEnabled ?? true,
    expiresAt: input.expiresAt ?? null,
    passwordHash: input.passwordHash ?? null,
    startsAt: input.startsAt ?? null,
    expirationDestination: input.expirationDestination ?? null,
    limitDestination: input.limitDestination ?? null,
    scheduledDestination: input.scheduledDestination ?? null,
    maximumVisits: input.maximumVisits ?? null,
    campaignId: input.campaignId ?? null,
    utmSource: input.utmSource ?? null,
    utmContent: input.utmContent ?? null,
    clickCount: input.clickCount ?? 0,
  }).returning();
  return link!.id;
}

export async function readTestLink(databaseUrl: string, linkId: string) {
  const db = openTestDatabase(databaseUrl);
  const rows = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
  return rows[0]!;
}

export const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
