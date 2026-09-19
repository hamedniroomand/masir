import { desc, eq } from 'drizzle-orm';
import { auditEvents, users } from '#server/database/schema';
import { requireWorkspaceMember } from '#server/utils/auth';
import { getDb } from '#server/utils/db';
import { findLinkById } from '#server/utils/link-repo';

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkById(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const db = await getDb();
  const rows = await db
    .select({
      id: auditEvents.id,
      type: auditEvents.type,
      createdAt: auditEvents.createdAt,
      detail: auditEvents.detail,
      actorName: users.email,
    })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorId, users.id))
    .where(eq(auditEvents.linkId, id))
    .orderBy(desc(auditEvents.createdAt))
    .limit(50);

  return {
    items: rows.map(row => ({
      id: row.id,
      type: row.type,
      createdAt: row.createdAt,
      actorName: row.actorName,
      fields: (row.detail as { fields?: string[] } | null)?.fields ?? null,
    })),
  };
});
