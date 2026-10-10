import type { H3Event } from 'h3';
import type { AuthIdentity, AuthProviderLabel, User } from '#server/database/schema';
import { and, eq, sql } from 'drizzle-orm';
import { authIdentities, users } from '#server/database/schema';
import { getDb, isUuid } from '#server/utils/db';

export const authProviders = ['PASSWORD', 'GOOGLE', 'MICROSOFT'] as const;

export type AuthProvider = typeof authProviders[number];

// The API keeps its uppercase strings. The database keeps lowercase enum
// labels. The two maps are the only place the two spellings meet.
const PROVIDER_LABEL: Record<AuthProvider, AuthProviderLabel> = {
  PASSWORD: 'password',
  GOOGLE: 'google',
  MICROSOFT: 'microsoft',
};

const PROVIDER_NAME: Record<AuthProviderLabel, AuthProvider> = {
  password: 'PASSWORD',
  google: 'GOOGLE',
  microsoft: 'MICROSOFT',
};

export type Identity = Omit<AuthIdentity, 'provider'> & { provider: AuthProvider };

function toIdentity(row: AuthIdentity): Identity {
  return { ...row, provider: PROVIDER_NAME[row.provider] };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  if (!isUuid(id))
    return null;
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findIdentity(provider: AuthProvider, providerAccountId: string): Promise<Identity | null> {
  const db = await getDb();
  const rows = await db.select().from(authIdentities).where(and(
    eq(authIdentities.provider, PROVIDER_LABEL[provider]),
    eq(authIdentities.providerAccountId, providerAccountId),
  )).limit(1);
  const row = rows[0];
  return row ? toIdentity(row) : null;
}

export async function attachIdentity(userId: string, input: {
  provider: AuthProvider;
  providerAccountId?: string;
  passwordHash?: string | null;
}) {
  const db = await getDb();
  await db.insert(authIdentities).values({
    userId,
    provider: PROVIDER_LABEL[input.provider],
    providerAccountId: input.providerAccountId ?? userId,
    passwordHash: input.passwordHash ?? null,
  });
}

export async function setPasswordHash(userId: string, passwordHash: string) {
  const db = await getDb();
  const existing = await findIdentity('PASSWORD', userId);
  if (existing) {
    await db.update(authIdentities)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(authIdentities.id, existing.id));
    return;
  }
  await attachIdentity(userId, { provider: 'PASSWORD', passwordHash });
}

export async function sessionVersionOf(userId: string): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.v ?? null;
}

// Raising the number ends every session that carries an older one.
export async function bumpSessionVersion(userId: string) {
  const db = await getDb();
  await db.update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function markLogin(userId: string) {
  const db = await getDb();
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

export async function setSessionUser(event: H3Event, user: User) {
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      sessionVersion: user.sessionVersion,
    },
  });
  await markLogin(user.id);
}
