// @ts-nocheck drizzle query types vs Nuxt auto-imports
import { desc } from 'drizzle-orm';
import { users } from '#server/database/schema';
import { requireAdmin } from '#server/utils/auth';
import { getDb } from '#server/utils/db';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = await getDb();
  const rows = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.createdAt));
  return { items: rows };
});
