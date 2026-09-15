import { desc, eq } from 'drizzle-orm';
import { securityEvents } from '#server/database/schema';
import { requireAdmin } from '#server/utils/auth';
import { getDb } from '#server/utils/db';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const type = getQuery(event).type;
  const db = await getDb();
  const rows = type && typeof type === 'string'
    ? await db.select().from(securityEvents).where(eq(securityEvents.type, type)).orderBy(desc(securityEvents.createdAt)).limit(200)
    : await db.select().from(securityEvents).orderBy(desc(securityEvents.createdAt)).limit(200);
  return {
    items: rows.map(r => ({
      ...r,
      detail: r.detail ? JSON.parse(r.detail) : null,
    })),
  };
});
