import { desc, eq } from 'drizzle-orm';
import { securityEvents, users } from '#server/database/schema';
import { requireWorkspaceMember } from '#server/utils/auth';
import { getDb } from '#server/utils/db';
import { findLinkById } from '#server/utils/link-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkById(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const db = await getDb();
  const rows = await db
    .select({
      id: securityEvents.id,
      type: securityEvents.type,
      createdAt: securityEvents.createdAt,
      detail: securityEvents.detail,
      actorName: users.email,
    })
    .from(securityEvents)
    .leftJoin(users, eq(securityEvents.actorUserId, users.id))
    .where(eq(securityEvents.linkId, id))
    .orderBy(desc(securityEvents.createdAt))
    .limit(50);

  return {
    items: rows.map(row => ({
      id: row.id,
      type: row.type,
      createdAt: row.createdAt,
      actorName: row.actorName,
      fields: (row.detail ? JSON.parse(row.detail).fields : null) as string[] | null,
    })),
  };
});
