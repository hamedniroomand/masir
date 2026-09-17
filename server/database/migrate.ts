import { dirname, join } from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { openDatabase } from '#server/database/client';

// Any constant works; it only has to be the same in every instance.
const LOCK_ID = 4919001;

export async function runMigrations(databaseUrl: string) {
  const db = openDatabase(databaseUrl);
  const migrationsFolder = join(dirname(Bun.fileURLToPath(import.meta.url)), '../../drizzle');
  try {
    // A rolling deploy starts the new instance before the old one stops, so two
    // can migrate at once and corrupt the migration table. The others wait here
    // and then find nothing to do.
    await db.execute(sql`select pg_advisory_lock(${LOCK_ID})`);
    try {
      await migrate(db, { migrationsFolder });
    }
    finally {
      await db.execute(sql`select pg_advisory_unlock(${LOCK_ID})`);
    }
  }
  finally {
    await db.$client.close();
  }
}
