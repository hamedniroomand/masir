import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { consumeAuthToken } from '#server/utils/auth-token';
import { readValidBody } from '#server/utils/body';
import { findUserById, markVerified, setSessionUser } from '#server/utils/identity-repo';

const bodySchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
});

export default defineEventHandler(async (event) => {
  const body = await readValidBody(event, bodySchema);
  const result = await consumeAuthToken('email_verify', body.token);
  if (!result.ok)
    throw createError({ statusCode: 400, statusMessage: 'This verification link is not valid.' });

  await markVerified(result.userId);
  await writeAuditEvent('email_verified', {}, { actor: result.userId });

  const user = await findUserById(result.userId);
  if (user)
    await setSessionUser(event, user);

  return { ok: true };
});
