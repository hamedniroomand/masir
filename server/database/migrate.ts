import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './client';

export async function runMigrations(databaseUrl: string) {
  const db = await openDatabase(databaseUrl);
  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');
  const isBun = 'Bun' in globalThis;
  if (isBun) {
    const { migrate } = await import('drizzle-orm/bun-sqlite/migrator');
    migrate(db as never, { migrationsFolder });
  }
  else {
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    migrate(db as never, { migrationsFolder });
  }
}
