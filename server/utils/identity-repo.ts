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

export async function listIdentities(userId: string): Promise<Identity[]> {
  const db = await getDb();
  const rows = await db.select().from(authIdentities).where(eq(authIdentities.userId, userId));
  return rows.map(toIdentity);
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

  return db.transaction(async (tx) => {
    const [created] = await tx.insert(users).values({
      email: normalizeEmail(input.email),
      emailVerifiedAt: input.emailVerified ? new Date() : null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      avatarUrl: input.avatarUrl ?? null,
    }).returning();
    if (!created)
      throw new Error('insert failed');

    await tx.insert(authIdentities).values({
      userId: created.id,
      provider: PROVIDER_LABEL[input.provider],
      // A password identity has no external account, so the user id serves.
      providerAccountId: input.providerAccountId ?? created.id,
      passwordHash: input.passwordHash ?? null,
    });
    return created;
  });
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

export async function markVerified(userId: string) {
  const db = await getDb();
  await db.update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
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

export async function setSessionUser(event: H3Event, user: User, options: { demo?: boolean } = {}) {
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt != null,
      sessionVersion: user.sessionVersion,
      ...(options.demo ? { demo: true } : {}),
    },
  });
  await markLogin(user.id);
}

export type OAuthProfile = {
  sub?: string;
  id?: string;
  email?: string | null;
  email_verified?: boolean;
  mail?: string | null;
  userPrincipalName?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  givenName?: string | null;
  surname?: string | null;
  picture?: string | null;
};

export function oauthEmailOf(provider: AuthProvider, profile: OAuthProfile): string | null {
  if (provider === 'GOOGLE')
    return profile.email ? normalizeEmail(profile.email) : null;
  // userPrincipalName first. Its suffix is a domain the tenant proved it owns,
  // while mail is a directory field a tenant admin can set. The identity is
  // linked onto an existing account, so the weaker field must not decide it.
  const address = profile.userPrincipalName ?? profile.mail ?? null;
  return address ? normalizeEmail(address) : null;
}

export function oauthAccountIdOf(profile: OAuthProfile): string | null {
  return profile.sub ?? profile.id ?? null;
}

// Google states whether it verified the address. Microsoft does not, so the
// claim rests on the userPrincipalName suffix being a domain the tenant owns.
// A mail-only profile carries no such proof and is not treated as verified.
export function oauthEmailVerified(provider: AuthProvider, profile: OAuthProfile) {
  if (provider === 'GOOGLE')
    return profile.email_verified === true;
  return Boolean(profile.userPrincipalName);
}

export async function resolveOAuthUser(provider: AuthProvider, profile: OAuthProfile): Promise<
  { ok: true; user: User } | { ok: false; reason: string }
> {
  const accountId = oauthAccountIdOf(profile);
  const email = oauthEmailOf(provider, profile);
  if (!accountId || !email)
    return { ok: false, reason: 'This provider did not give an email address.' };

  const identity = await findIdentity(provider, accountId);
  if (identity) {
    const user = await findUserById(identity.userId);
    if (!user)
      return { ok: false, reason: 'This account is not available.' };
    return { ok: true, user };
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    if (!canLinkToUser(existing, oauthEmailVerified(provider, profile)))
      return { ok: false, reason: 'An account already uses this email. Sign in with your password first, then connect this provider.' };
    await attachIdentity(existing.id, { provider, providerAccountId: accountId });
    return { ok: true, user: existing };
  }

  const user = await createUserWithIdentity({
    email,
    provider,
    providerAccountId: accountId,
    emailVerified: oauthEmailVerified(provider, profile),
    firstName: profile.given_name ?? profile.givenName ?? null,
    lastName: profile.family_name ?? profile.surname ?? null,
    avatarUrl: profile.picture ?? null,
  });
  return { ok: true, user };
}
