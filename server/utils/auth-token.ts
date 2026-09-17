import type { passwordResetTokens } from '#server/database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { emailVerificationTokens } from '#server/database/schema';
import { verifyEmailMessage } from '#server/emails/verify-email';
import { getDb } from '#server/utils/db';
import { sendMail } from '#server/utils/mail';
import { newId } from '#shared/id';

export type AuthTokenTable = typeof emailVerificationTokens | typeof passwordResetTokens;

export const VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const RESET_LIFETIME_MS = 60 * 60 * 1000;

export function newAuthToken() {
  // 32 bytes of CSPRNG output, url safe and unpadded so the token can sit in a
  // link without escaping.
  return crypto.getRandomValues(new Uint8Array(32)).toBase64({ alphabet: 'base64url', omitPadding: true });
}

// The database holds the hash. A stolen database row cannot be replayed.
export function hashAuthToken(raw: string) {
  return new Bun.CryptoHasher('sha256').update(raw).digest('hex');
}

export async function createAuthToken(table: AuthTokenTable, userId: string, lifetimeMs: number) {
  const db = await getDb();
  const raw = newAuthToken();
  await db.insert(table).values({
    id: newId(),
    userId,
    tokenHash: hashAuthToken(raw),
    expiresAt: new Date(Date.now() + lifetimeMs),
    consumedAt: null,
    createdAt: new Date(),
  });
  return raw;
}

export async function consumeAuthToken(table: AuthTokenTable, raw: string): Promise<
  { ok: true; userId: string } | { ok: false; reason: 'invalid' | 'expired' | 'used' }
> {
  const db = await getDb();
  const hash = hashAuthToken(raw);
  const rows = await db.select().from(table).where(eq(table.tokenHash, hash)).limit(1);
  const row = rows[0];
  if (!row)
    return { ok: false, reason: 'invalid' };
  if (row.consumedAt)
    return { ok: false, reason: 'used' };
  if (row.expiresAt.getTime() <= Date.now())
    return { ok: false, reason: 'expired' };

  // The guard makes the read and the write one statement, so two requests
  // carrying the same token cannot both succeed.
  const claimed = await db.update(table)
    .set({ consumedAt: new Date() })
    .where(and(eq(table.id, row.id), isNull(table.consumedAt)))
    .returning({ id: table.id });
  if (!claimed.length)
    return { ok: false, reason: 'used' };

  return { ok: true, userId: row.userId };
}

export async function revokeAuthTokens(table: AuthTokenTable, userId: string) {
  const db = await getDb();
  await db.update(table)
    .set({ consumedAt: new Date() })
    .where(and(eq(table.userId, userId), isNull(table.consumedAt)));
}

export async function sendVerification(userId: string, email: string) {
  const { rootDomain } = useRuntimeConfig();
  const raw = await createAuthToken(emailVerificationTokens, userId, VERIFICATION_LIFETIME_MS);
  const link = `${rootDomain.replace(/\/$/, '')}/verify-email?token=${raw}`;
  await sendMail(verifyEmailMessage(email, link));
}
