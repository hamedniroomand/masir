import { and, eq } from 'drizzle-orm';
import { authIdentities } from '#server/database/schema';
import { requireUser } from '#server/utils/auth';
import { getDb } from '#server/utils/db';
import { listIdentities } from '#server/utils/identity-repo';
import { writeSecurityEvent } from '#server/utils/security-log';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const identities = await listIdentities(user.id);
  const target = identities.find(row => row.id === id);
  if (!target)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  // A user who removes the last identity can never sign in again.
  if (identities.length <= 1) {
    const reason = 'You cannot disconnect your only sign-in method.';
    throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
  }

  const db = await getDb();
  await db.delete(authIdentities).where(and(
    eq(authIdentities.id, id),
    eq(authIdentities.userId, user.id),
  ));
  await writeSecurityEvent('identity_disconnected', { provider: target.provider }, user.id);

  return { ok: true };
});
