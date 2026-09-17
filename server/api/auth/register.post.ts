import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { sendVerification } from '#server/utils/auth-token';
import { readValidBody } from '#server/utils/body';
import { createUserWithIdentity, findUserByEmail, normalizeEmail } from '#server/utils/identity-repo';
import { hashSecret } from '#server/utils/password';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';

const bodySchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email('Enter a valid email.')),
  password: v.pipe(v.string(), v.minLength(12, 'Use at least 12 characters.'), v.maxLength(200)),
});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  if (!config.allowRegistration)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = await readValidBody(event, bodySchema);
  const email = normalizeEmail(body.email);

  const clientKey = await hashClientKey(event);
  const byClient = await rateLimitCheck(`register:${clientKey}`, 5, 3_600_000);
  if (!byClient.ok) {
    setResponseHeader(event, 'Retry-After', byClient.retryAfterSec);
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' });
  }
  const byEmail = await rateLimitCheck(`register-email:${email}`, 3, 3_600_000);
  if (!byEmail.ok)
    return { ok: true };

  // The answer never says whether the address is already in use.
  const existing = await findUserByEmail(email);
  if (existing) {
    await writeAuditEvent('register_duplicate', { email });
    return { ok: true };
  }

  const user = await createUserWithIdentity({
    email,
    provider: 'PASSWORD',
    passwordHash: await hashSecret(body.password),
    emailVerified: false,
  });
  await writeAuditEvent('user_registered', { email }, { actor: user.id });
  await sendVerification(user.id, email);

  return { ok: true };
});
