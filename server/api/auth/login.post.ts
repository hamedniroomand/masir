import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { readValidBody } from '#server/utils/body';
import { findIdentity, findUserByEmail, normalizeEmail, setSessionUser } from '#server/utils/identity-repo';
import { matchAbsentSecret, verifySecret } from '#server/utils/password';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';

const bodySchema = v.object({
  email: v.pipe(v.string(), v.minLength(1)),
  password: v.pipe(v.string(), v.minLength(1)),
});

const GENERIC = 'Invalid email or password.';

export default defineEventHandler(async (event) => {
  const body = await readValidBody(event, bodySchema);
  const email = normalizeEmail(body.email);
  const config = useRuntimeConfig();

  // argon2id holds 64MiB for each check. Without a limit, an unauthenticated
  // caller can both guess passwords and exhaust the memory of the process.
  const clientKey = await hashClientKey(event);
  const byClient = await rateLimitCheck(`login:${clientKey}`, config.rateLimitLoginPerMinute, 60_000);
  if (!byClient.ok) {
    setResponseHeader(event, 'Retry-After', byClient.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }
  const byEmail = await rateLimitCheck(`login-email:${email}`, config.rateLimitLoginPerMinute, 60_000);
  if (!byEmail.ok) {
    setResponseHeader(event, 'Retry-After', byEmail.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  const fail = async () => {
    await writeAuditEvent('login_failed', { email });
    setResponseStatus(event, 401);
    return { error: GENERIC };
  };

  const user = await findUserByEmail(email);
  const identity = user ? await findIdentity('PASSWORD', user.id) : null;

  // No account, or an account that signs in with a provider only. Spend the
  // same time a real check spends, so the answer does not name which.
  if (!user || !identity?.passwordHash) {
    await matchAbsentSecret(body.password);
    return fail();
  }

  const ok = await verifySecret(body.password, identity.passwordHash);
  if (!ok)
    return fail();

  await setSessionUser(event, user);
  return { ok: true };
});
