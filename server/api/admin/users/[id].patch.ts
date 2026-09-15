// @ts-nocheck drizzle query types vs Nuxt auto-imports
import { and, eq, sql } from 'drizzle-orm';
import * as v from 'valibot';
import { users } from '#server/database/schema';
import { requireAdmin } from '#server/utils/auth';
import { getDb } from '#server/utils/db';
import { writeSecurityEvent } from '#server/utils/security-log';

const bodySchema = v.object({
  isActive: v.optional(v.boolean()),
  role: v.optional(v.picklist(['admin', 'member'])),
});

async function activeAdminCount(db: Awaited<ReturnType<typeof getDb>>) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(users).where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
  return n;
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const body = v.parse(bodySchema, await readBody(event));
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  if (body.isActive === false && target.role === 'admin') {
    const admins = await activeAdminCount(db);
    if (admins <= 1) {
      throw createError({ statusCode: 422, statusMessage: 'Cannot deactivate the only active admin.' });
    }
  }

  if (body.role === 'member' && target.role === 'admin') {
    const admins = await activeAdminCount(db);
    if (admins <= 1) {
      throw createError({ statusCode: 422, statusMessage: 'Cannot demote the only active admin.' });
    }
  }

  const patch: Partial<typeof users.$inferInsert> = {};
  if (body.isActive !== undefined)
    patch.isActive = body.isActive;
  if (body.role !== undefined)
    patch.role = body.role;

  if (Object.keys(patch).length === 0)
    return { ok: true };

  await db.update(users).set(patch).where(eq(users.id, id));

  if (body.isActive === false) {
    await writeSecurityEvent('user_deactivated', { userId: id }, admin.id);
  }
  if (body.role !== undefined && body.role !== target.role) {
    await writeSecurityEvent('role_changed', { userId: id, role: body.role }, admin.id);
  }

  return { ok: true };
});
