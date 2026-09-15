import type { AppDatabase } from '#server/database/client';
import {

  closeDatabase,
  getMemoisedDb,
  openDatabase,
  setMemoisedDb,
} from '#server/database/client';

export { type AppDatabase, closeDatabase, openDatabase };

export function isUniqueViolation(e: unknown) {
  return e instanceof Error && /unique/i.test(e.message);
}

export async function getDb(): Promise<AppDatabase> {
  const existing = getMemoisedDb();
  if (existing)
    return existing;
  const { databaseUrl } = useRuntimeConfig();
  const db = await openDatabase(databaseUrl);
  setMemoisedDb(db);
  return db;
}
