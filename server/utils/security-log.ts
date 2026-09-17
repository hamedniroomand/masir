import { securityEvents } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { newId } from '#shared/id';

// An options object, not more positional arguments. actor, workspaceId and
// linkId are all nullable strings, so a positional mix-up would compile and
// write the wrong column.
export type SecurityEventContext = {
  actor?: string | null;
  workspaceId?: string | null;
  linkId?: string | null;
};

export async function writeSecurityEvent(
  type: string,
  detail?: Record<string, unknown>,
  context: SecurityEventContext = {},
) {
  const db = await getDb();
  await db.insert(securityEvents).values({
    id: newId(),
    createdAt: new Date(),
    type,
    workspaceId: context.workspaceId ?? null,
    actorUserId: context.actor ?? null,
    linkId: context.linkId ?? null,
    detail: detail ? JSON.stringify(detail) : null,
  });
}
