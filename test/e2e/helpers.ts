import { eq } from 'drizzle-orm';
import { hashPassword } from '#scripts/hash-password';
import { campaigns, links, users } from '#server/database/schema';
import { newId } from '#shared/id';
import { createTestDatabase, openTestDatabase, truncateTestDatabase } from './test-db';
import { startTestServer } from './test-server';

export { testDatabaseUrl } from './test-db';

const sharedEnv = {
  NUXT_SESSION_PASSWORD: '01234567890123456789012345678901',
  NUXT_PUBLIC_SHORT_DOMAIN: 'http://127.0.0.1:3000',
};

// The Nuxt server migrates on boot, so the database must exist before setup().
export async function e2eSetupOptions(databaseUrl: string) {
  await createTestDatabase(databaseUrl);
  const host = await startTestServer({ ...sharedEnv, NUXT_DATABASE_URL: databaseUrl });
  // host makes setup() skip the build and the server. It only points the test
  // helpers at the server this file started.
  return { host, runner: 'vitest' as const };
}

export const TEST_EMAIL = 'test@example.com';
export const TEST_PASSWORD = 'test-password-12345';

export async function resetTestDb(databaseUrl: string) {
  await truncateTestDatabase(databaseUrl);
  const db = openTestDatabase(databaseUrl);
  const userId = newId();
  await db.insert(users).values({
    id: userId,
    email: TEST_EMAIL,
    passwordHash: await hashPassword(TEST_PASSWORD),
    name: 'Test User',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
  });
  return { db, userId };
}

export async function insertTestCampaign(databaseUrl: string, input: {
  userId: string;
  name?: string;
  utmCampaign: string;
  utmMedium?: string | null;
}) {
  const db = openTestDatabase(databaseUrl);
  const id = newId();
  const now = new Date();
  await db.insert(campaigns).values({
    id,
    userId: input.userId,
    name: input.name ?? input.utmCampaign,
    utmCampaign: input.utmCampaign,
    utmMedium: input.utmMedium ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function insertTestLink(databaseUrl: string, input: {
  userId: string;
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
    userId: input.userId,
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
