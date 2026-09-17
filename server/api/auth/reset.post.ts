import * as v from 'valibot';
import { passwordResetTokens } from '#server/database/schema';
import { consumeAuthToken, revokeAuthTokens } from '#server/utils/auth-token';
import { readValidBody } from '#server/utils/body';
import { bumpSessionVersion, setPasswordHash } from '#server/utils/identity-repo';
import { hashSecret } from '#server/utils/password';
import { writeSecurityEvent } from '#server/utils/security-log';

const bodySchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  password: v.pipe(v.string(), v.minLength(12, 'Use at least 12 characters.'), v.maxLength(200)),
});

export default defineEventHandler(async (event) => {
  const body = await readValidBody(event, bodySchema);
  const result = await consumeAuthToken(passwordResetTokens, body.token);
  if (!result.ok)
    throw createError({ statusCode: 400, statusMessage: 'This recovery link is not valid.' });

  await setPasswordHash(result.userId, await hashSecret(body.password));
  // Every other outstanding link stops working.
  await revokeAuthTokens(passwordResetTokens, result.userId);
  // Every session anywhere stops working, not only the caller's. A stolen
  // cookie must not survive the theft victim changing the password.
  await bumpSessionVersion(result.userId);
  await clearUserSession(event);
  await writeSecurityEvent('password_reset', {}, result.userId);

  return { ok: true };
});
