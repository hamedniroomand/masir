import * as v from 'valibot';
import { findIdentity, findUserByEmail, normalizeEmail, setSessionUser } from '#server/utils/identity-repo';
import { writeSecurityEvent } from '#server/utils/security-log';

const bodySchema = v.object({
  email: v.pipe(v.string(), v.minLength(1)),
  password: v.pipe(v.string(), v.minLength(1)),
});

const GENERIC = 'Invalid email or password.';

export default defineEventHandler(async (event) => {
  const body = v.parse(bodySchema, await readBody(event));
  const email = normalizeEmail(body.email);

  const fail = async () => {
    await writeSecurityEvent('login_failed', { email });
    setResponseStatus(event, 401);
    return { error: GENERIC };
  };

  const user = await findUserByEmail(email);
  if (!user)
    return fail();

  const identity = await findIdentity('PASSWORD', user.id);
  if (!identity?.passwordHash)
    return fail();

  const ok = await verifyPassword(identity.passwordHash, body.password);
  if (!ok)
    return fail();

  await setSessionUser(event, user);
  return { ok: true };
});
