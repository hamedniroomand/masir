import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { openDatabase } from '#server/database/client';

export async function runMigrations(databaseUrl: string) {
  const db = openDatabase(databaseUrl);
  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');
  try {
    await migrate(db, { migrationsFolder });
  }
  finally {
    await db.$client.close();
  }
}
