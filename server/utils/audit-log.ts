import { auditEvents } from '#server/database/schema';
import { getDb } from '#server/utils/db';

// An options object, not more positional arguments. actor, workspaceId and
// linkId are all nullable strings, so a positional mix-up would compile and
// write the wrong column.
export type AuditEventContext = {
  actor?: string | null;
  workspaceId?: string | null;
  linkId?: string | null;
};

export async function writeAuditEvent(
  type: string,
  detail?: Record<string, unknown>,
  context: AuditEventContext = {},
) {
  const db = await getDb();
  await db.insert(auditEvents).values({
    type,
    workspaceId: context.workspaceId ?? null,
    actorId: context.actor ?? null,
    linkId: context.linkId ?? null,
    detail: detail ?? null,
  });
}
