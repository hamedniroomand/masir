import { and, desc, eq } from 'drizzle-orm';
import { securityEvents } from '#server/database/schema';
import { requireWorkspaceMember } from '#server/utils/auth';
import { getDb } from '#server/utils/db';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'workspace.manage');
  const type = getQuery(event).type;
  const db = await getDb();

  // A row with no workspace belongs to no tenant: sign-in failures, OAuth
  // errors, abuse reports. eq() never matches null, so those stay operator-only
  // and never reach a workspace.
  const filters = [eq(securityEvents.workspaceId, workspaceId)];
  if (typeof type === 'string' && type)
    filters.push(eq(securityEvents.type, type));

  const rows = await db
    .select()
    .from(securityEvents)
    .where(and(...filters))
    .orderBy(desc(securityEvents.createdAt))
    .limit(200);

  return {
    items: rows.map(row => ({
      ...row,
      detail: row.detail ? JSON.parse(row.detail) : null,
    })),
  };
});
