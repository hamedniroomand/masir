import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { consumeAuthToken, revokeAuthTokens } from '#server/utils/auth-token';
import { readValidBody } from '#server/utils/body';
import { bumpSessionVersion, setPasswordHash } from '#server/utils/identity-repo';
import { hashSecret } from '#server/utils/password';
import { accountPasswordSchema } from '#shared/account-password';

const bodySchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  password: accountPasswordSchema,
});

export default defineEventHandler(async (event) => {
  const body = await readValidBody(event, bodySchema);
  const result = await consumeAuthToken('password_reset', body.token);
  if (!result.ok)
    throw createError({ statusCode: 400, statusMessage: 'This recovery link is not valid.' });

  await setPasswordHash(result.userId, await hashSecret(body.password));
  // Every other outstanding link stops working.
  await revokeAuthTokens('password_reset', result.userId);
  // Every session anywhere stops working, not only the caller's. A stolen
  // cookie must not survive the theft victim changing the password.
  await bumpSessionVersion(result.userId);
  await clearUserSession(event);
  await writeAuditEvent('password_reset', {}, { actor: result.userId });

  return { ok: true };
});
