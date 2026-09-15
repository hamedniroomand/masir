import { sql } from 'drizzle-orm';
import { getDb } from '#server/utils/db';

export default defineEventHandler(async () => {
  try {
    const db = await getDb();
    await db.get(sql`SELECT 1`);
    return { ok: true, database: 'up' };
  }
  catch {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' });
  }
});
