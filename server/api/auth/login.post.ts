import { eq } from 'drizzle-orm';
import * as v from 'valibot';
import { users } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { writeSecurityEvent } from '#server/utils/security-log';

const bodySchema = v.object({
  email: v.pipe(v.string(), v.minLength(1)),
  password: v.pipe(v.string(), v.minLength(1)),
});

const GENERIC = 'Invalid email or password.';

export default defineEventHandler(async (event) => {
  const body = v.parse(bodySchema, await readBody(event));
  const email = body.email.trim().toLowerCase();
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];

  const fail = async () => {
    await writeSecurityEvent('login_failed', { email });
    setResponseStatus(event, 401);
    return { error: GENERIC };
  };

  if (!user)
    return fail();

  const ok = await verifyPassword(user.passwordHash, body.password);
  if (!ok)
    return fail();

  if (!user.isActive)
    return fail();

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });

  return { ok: true };
});
