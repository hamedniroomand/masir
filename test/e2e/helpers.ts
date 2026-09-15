import { rmSync } from 'node:fs';
import { hashPassword } from '#scripts/hash-password';
import { links, users } from '#server/database/schema';
import { newId } from '#shared/id';
import { migrateTestDatabase, openTestDatabase } from './test-db';

const sharedEnv = {
  NUXT_SESSION_PASSWORD: '01234567890123456789012345678901',
  NUXT_PUBLIC_SHORT_DOMAIN: 'http://127.0.0.1:3000',
};

export function e2eSetupOptions(databaseUrl: string) {
  return {
    server: true,
    runner: 'vitest' as const,
    env: {
      ...sharedEnv,
      NUXT_DATABASE_URL: databaseUrl,
    },
    nuxtConfig: { nitro: { preset: 'node-server' } },
  };
}

export function testDatabasePath(name: string) {
  return `file:./data/vitest-${name}.db`;
}

export const TEST_EMAIL = 'test@example.com';
export const TEST_PASSWORD = 'test-password-12345';

function dbFilePath(databaseUrl: string) {
  return databaseUrl.replace(/^file:/, '');
}

export async function resetTestDb(databaseUrl: string) {
  rmSync(dbFilePath(databaseUrl), { force: true });
  migrateTestDatabase(databaseUrl);
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

export async function insertTestLink(databaseUrl: string, input: {
  userId: string;
  slug: string;
  destinationUrl?: string;
  isEnabled?: boolean;
  expiresAt?: Date | null;
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
    clickCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
