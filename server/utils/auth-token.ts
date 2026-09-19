import type { TokenPurpose } from '#server/database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { userTokens } from '#server/database/schema';
import { verifyEmailMessage } from '#server/emails/verify-email';
import { getDb } from '#server/utils/db';
import { sendMail } from '#server/utils/mail';
import { appUrl } from '#shared/deployment';

export const VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const RESET_LIFETIME_MS = 60 * 60 * 1000;

export function newAuthToken() {
  // 32 bytes of CSPRNG output, url safe and unpadded so the token can sit in a
  // link without escaping.
  return crypto.getRandomValues(new Uint8Array(32)).toBase64({ alphabet: 'base64url', omitPadding: true });
}

// The database holds the hash. A stolen database row cannot be replayed.
export function hashAuthToken(raw: string) {
  return new Bun.CryptoHasher('sha256').update(raw).digest();
}

export async function createAuthToken(purpose: TokenPurpose, userId: string, lifetimeMs: number) {
  const db = await getDb();
  const raw = newAuthToken();
  await db.insert(userTokens).values({
    userId,
    purpose,
    tokenHash: hashAuthToken(raw),
    expiresAt: new Date(Date.now() + lifetimeMs),
  });
  return raw;
}

export async function consumeAuthToken(purpose: TokenPurpose, raw: string): Promise<
  { ok: true; userId: string } | { ok: false; reason: 'invalid' | 'expired' | 'used' }
> {
  const db = await getDb();
  const rows = await db.select().from(userTokens).where(and(
    eq(userTokens.purpose, purpose),
    eq(userTokens.tokenHash, hashAuthToken(raw)),
  )).limit(1);
  const row = rows[0];
  if (!row)
    return { ok: false, reason: 'invalid' };
  if (row.consumedAt)
    return { ok: false, reason: 'used' };
  if (row.expiresAt.getTime() <= Date.now())
    return { ok: false, reason: 'expired' };

  // The guard makes the read and the write one statement, so two requests
  // carrying the same token cannot both succeed.
  const claimed = await db.update(userTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(userTokens.id, row.id), isNull(userTokens.consumedAt)))
    .returning({ id: userTokens.id });
  if (!claimed.length)
    return { ok: false, reason: 'used' };

  return { ok: true, userId: row.userId };
}

export async function revokeAuthTokens(purpose: TokenPurpose, userId: string) {
  const db = await getDb();
  await db.update(userTokens)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(userTokens.purpose, purpose),
      eq(userTokens.userId, userId),
      isNull(userTokens.consumedAt),
    ));
}

export async function sendVerification(userId: string, email: string) {
  const raw = await createAuthToken('email_verify', userId, VERIFICATION_LIFETIME_MS);
  const link = `${appUrl(useRuntimeConfig() as never)}/verify-email?token=${raw}`;
  await sendMail(verifyEmailMessage(email, link));
}
