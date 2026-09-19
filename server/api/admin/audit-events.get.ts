import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { auditEvents, links, users } from '#server/database/schema';
import { requireWorkspaceMember } from '#server/utils/auth';
import { getDb } from '#server/utils/db';
import { isAuditGroup, typesInGroup } from '#shared/audit-groups';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'workspace.manage');
  const query = getQuery(event);
  const db = await getDb();

  // A row with no workspace belongs to no tenant: sign-in failures, OAuth
  // errors, abuse reports. eq() never matches null, so those stay operator-only
  // and never reach a workspace.
  const filters = [eq(auditEvents.workspaceId, workspaceId)];

  const type = query.type;
  if (typeof type === 'string' && type)
    filters.push(eq(auditEvents.type, type));
  else if (isAuditGroup(query.group))
    filters.push(inArray(auditEvents.type, typesInGroup(query.group)));

  // The id is a monotonic identity column, so it orders the same way the
  // timestamp does and never repeats inside one millisecond.
  const before = Number(query.before);
  if (Number.isSafeInteger(before) && before > 0)
    filters.push(lt(auditEvents.id, before));

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));

  const rows = await db
    .select({
      id: auditEvents.id,
      type: auditEvents.type,
      createdAt: auditEvents.createdAt,
      detail: auditEvents.detail,
      actorId: auditEvents.actorId,
      actorEmail: users.email,
      linkId: auditEvents.linkId,
      linkSlug: links.slug,
    })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorId, users.id))
    .leftJoin(links, eq(auditEvents.linkId, links.id))
    .where(and(...filters))
    .orderBy(desc(auditEvents.id))
    .limit(limit);

  const last = rows.at(-1);
  return {
    items: rows,
    // Null means the last page, so the client knows to stop asking.
    nextBefore: last && rows.length === limit ? last.id : null,
  };
});
