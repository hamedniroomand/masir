import * as v from 'valibot';
import { sendVerification } from '#server/utils/auth-token';
import { readValidBody } from '#server/utils/body';
import { findUserByEmail, normalizeEmail } from '#server/utils/identity-repo';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';

const bodySchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email('Enter a valid email.')),
});

export default defineEventHandler(async (event) => {
  const body = await readValidBody(event, bodySchema);
  const email = normalizeEmail(body.email);

  const clientKey = await hashClientKey(event);
  const limit = await rateLimitCheck(`verify-resend:${clientKey}`, 5, 3_600_000);
  if (!limit.ok) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  // The answer never says whether the address exists or is already verified.
  const user = await findUserByEmail(email);
  if (user && !user.emailVerifiedAt)
    await sendVerification(user.id, email);

  return { ok: true };
});
