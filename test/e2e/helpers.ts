import { eq } from 'drizzle-orm';
import { authIdentities, campaigns, links, users, workspaceMembers, workspaces } from '#server/database/schema';
import { hashSecret } from '#server/utils/password';
import { newId } from '#shared/id';
import { createTestDatabase, openTestDatabase, truncateTestDatabase } from './test-db';
import { startTestServer } from './test-server';

export { testDatabaseUrl } from './test-db';

const sharedEnv = {
  NUXT_SESSION_PASSWORD: '01234567890123456789012345678901',
  NUXT_PUBLIC_SHORT_DOMAIN: 'http://127.0.0.1:3000',
  NUXT_ALLOW_REGISTRATION: 'true',
  NUXT_MAIL_DRIVER: 'outbox',
  // Test files run together. A pool of 10 for each would exhaust Postgres.
  NUXT_DATABASE_POOL_MAX: '2',
};

// The Nuxt server migrates on boot, so the database must exist before setup().
export async function e2eSetupOptions(databaseUrl: string) {
  await createTestDatabase(databaseUrl);
  const host = await startTestServer({ ...sharedEnv, NUXT_DATABASE_URL: databaseUrl });
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
  const userId = newId();
  const now = new Date();
  await db.insert(users).values({
    id: userId,
    email: input.email,
    emailVerifiedAt: input.verified === false ? null : now,
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });
  await db.insert(authIdentities).values({
    id: newId(),
    userId,
    provider: 'PASSWORD',
    providerAccountId: userId,
    passwordHash: await hashSecret(input.password),
    createdAt: now,
    updatedAt: now,
  });
  return userId;
}

export async function resetTestDb(databaseUrl: string) {
  await truncateTestDatabase(databaseUrl);
  const db = openTestDatabase(databaseUrl);
  const userId = await insertTestUser(databaseUrl, { email: TEST_EMAIL, password: TEST_PASSWORD });
  const workspaceId = newId();
  const now = new Date();
  await db.insert(workspaces).values({
    id: workspaceId,
    name: 'Acme',
    slug: TEST_WORKSPACE_SLUG,
    plan: 'TRIAL',
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workspaceMembers).values({
    id: newId(),
    workspaceId,
    userId,
    role: 'OWNER',
    createdAt: now,
    updatedAt: now,
  });
  return { db, userId, workspaceId };
}

export async function insertTestWorkspace(databaseUrl: string, input: {
  slug: string;
  name?: string;
  ownerUserId: string;
}) {
  const db = openTestDatabase(databaseUrl);
  const now = new Date();
  const workspaceId = newId();
  await db.insert(workspaces).values({
    id: workspaceId,
    name: input.name ?? input.slug,
    slug: input.slug,
    plan: 'TRIAL',
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workspaceMembers).values({
    id: newId(),
    workspaceId,
    userId: input.ownerUserId,
    role: 'OWNER',
    createdAt: now,
    updatedAt: now,
  });
  return workspaceId;
}

export async function insertTestCampaign(databaseUrl: string, input: {
  workspaceId: string;
  createdByUserId?: string;
  name?: string;
  utmCampaign: string;
  utmMedium?: string | null;
}) {
  const db = openTestDatabase(databaseUrl);
  const id = newId();
  const now = new Date();
  await db.insert(campaigns).values({
    id,
    workspaceId: input.workspaceId,
    createdByUserId: input.createdByUserId ?? null,
    name: input.name ?? input.utmCampaign,
    utmCampaign: input.utmCampaign,
    utmMedium: input.utmMedium ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function insertTestLink(databaseUrl: string, input: {
  workspaceId: string;
  createdByUserId?: string;
  slug: string;
  destinationUrl?: string;
  isEnabled?: boolean;
  expiresAt?: Date | null;
  campaignId?: string | null;
  utmSource?: string | null;
  utmContent?: string | null;
  passwordHash?: string | null;
  startsAt?: Date | null;
  expirationDestination?: string | null;
  maximumVisits?: number | null;
  successfulVisitCount?: number;
}) {
  const db = openTestDatabase(databaseUrl);
  const id = newId();
  const now = new Date();
  await db.insert(links).values({
    id,
    workspaceId: input.workspaceId,
    createdByUserId: input.createdByUserId ?? null,
    slug: input.slug,
    title: null,
    destinationUrl: input.destinationUrl ?? 'https://example.com/target',
    destinationHost: 'example.com',
    isEnabled: input.isEnabled ?? true,
    expiresAt: input.expiresAt ?? null,
    passwordHash: input.passwordHash ?? null,
    startsAt: input.startsAt ?? null,
    expirationDestination: input.expirationDestination ?? null,
    maximumVisits: input.maximumVisits ?? null,
    successfulVisitCount: input.successfulVisitCount ?? 0,
    campaignId: input.campaignId ?? null,
    utmSource: input.utmSource ?? null,
    utmContent: input.utmContent ?? null,
    clickCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function readTestLink(databaseUrl: string, linkId: string) {
  const db = openTestDatabase(databaseUrl);
  const rows = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
  return rows[0]!;
}

export const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
