import type { H3Event } from 'h3';
import type { AuthIdentity, AuthProvider, User } from '#server/database/schema';
import { and, eq } from 'drizzle-orm';
import { authIdentities, users } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { newId } from '#shared/id';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// A provider identity joins an existing user only when both sides already
// proved the address. Either half alone is a takeover path.
export function canLinkToUser(user: { emailVerifiedAt: Date | null }, providerVerifiedEmail: boolean) {
  return providerVerifiedEmail && user.emailVerifiedAt != null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findIdentity(provider: AuthProvider, providerAccountId: string): Promise<AuthIdentity | null> {
  const db = await getDb();
  const rows = await db.select().from(authIdentities).where(and(
    eq(authIdentities.provider, provider),
    eq(authIdentities.providerAccountId, providerAccountId),
  )).limit(1);
  return rows[0] ?? null;
}

export async function listIdentities(userId: string): Promise<AuthIdentity[]> {
  const db = await getDb();
  return db.select().from(authIdentities).where(eq(authIdentities.userId, userId));
}

export async function createUserWithIdentity(input: {
  email: string;
  provider: AuthProvider;
  providerAccountId?: string;
  passwordHash?: string | null;
  emailVerified: boolean;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}): Promise<User> {
  const db = await getDb();
  const now = new Date();
  const id = newId();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      email: normalizeEmail(input.email),
      emailVerifiedAt: input.emailVerified ? now : null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
    await tx.insert(authIdentities).values({
      id: newId(),
      userId: id,
      provider: input.provider,
      // A password identity has no external account, so the user id serves.
      providerAccountId: input.providerAccountId ?? id,
      passwordHash: input.passwordHash ?? null,
      createdAt: now,
      updatedAt: now,
    });
  });

  const created = await findUserById(id);
  if (!created)
    throw new Error('insert failed');
  return created;
}

export async function attachIdentity(userId: string, input: {
  provider: AuthProvider;
  providerAccountId?: string;
  passwordHash?: string | null;
}) {
  const db = await getDb();
  const now = new Date();
  await db.insert(authIdentities).values({
    id: newId(),
    userId,
    provider: input.provider,
    providerAccountId: input.providerAccountId ?? userId,
    passwordHash: input.passwordHash ?? null,
    createdAt: now,
    updatedAt: now,
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

export async function markVerified(userId: string) {
  const db = await getDb();
  await db.update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
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
      emailVerified: user.emailVerifiedAt != null,
    },
  });
  await markLogin(user.id);
}
