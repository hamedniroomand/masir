import * as v from 'valibot';
import { resetPasswordMessage } from '#server/emails/reset-password';
import { createAuthToken, RESET_LIFETIME_MS } from '#server/utils/auth-token';
import { readValidBody } from '#server/utils/body';
import { findUserByEmail, normalizeEmail } from '#server/utils/identity-repo';
import { sendMail } from '#server/utils/mail';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';

const bodySchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email('Enter a valid email.')),
});

const ANSWER = 'If an account exists for this email, we sent a recovery link.';

export default defineEventHandler(async (event) => {
  const body = await readValidBody(event, bodySchema);
  const email = normalizeEmail(body.email);

  const clientKey = await hashClientKey(event);
  const limit = await rateLimitCheck(`forgot:${clientKey}`, 5, 3_600_000);
  if (!limit.ok) {
    setResponseHeader(event, 'Retry-After', limit.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }

  const user = await findUserByEmail(email);
  if (user) {
    const { rootDomain } = useRuntimeConfig();
    const raw = await createAuthToken('password_reset', user.id, RESET_LIFETIME_MS);
    const link = `${rootDomain.replace(/\/$/, '')}/reset-password?token=${raw}`;
    await sendMail(resetPasswordMessage(email, link));
  }

  return { message: ANSWER };
});
