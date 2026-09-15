import { securityEvents } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { newId } from '#shared/id';

export async function writeSecurityEvent(
  type: string,
  detail?: Record<string, unknown>,
  actorUserId?: string | null,
  linkId?: string | null,
) {
  const db = await getDb();
  await db.insert(securityEvents).values({
    id: newId(),
    createdAt: new Date(),
    type,
    actorUserId: actorUserId ?? null,
    linkId: linkId ?? null,
    detail: detail ? JSON.stringify(detail) : null,
  });
}
