import type { AppDatabase } from '#server/database/client';
import {

  closeDatabase,
  getMemoisedDb,
  openDatabase,
  setMemoisedDb,
} from '#server/database/client';

export { type AppDatabase, closeDatabase, openDatabase };

const UNIQUE_VIOLATION = '23505';

// Postgres reports a unique constraint breach with SQLSTATE 23505. Bun puts the
// SQLSTATE in errno, not code. Drizzle wraps the driver error, so the value can
// sit further down the cause chain.
export function isUniqueViolation(e: unknown) {
  for (let cause = e, depth = 0; cause != null && depth < 5; depth++) {
    if (typeof cause === 'object' && String((cause as { errno?: unknown }).errno) === UNIQUE_VIOLATION)
      return true;
    cause = (cause as { cause?: unknown }).cause;
  }
  return false;
}

export async function getDb(): Promise<AppDatabase> {
  const existing = getMemoisedDb();
  if (existing)
    return existing;
  const { databaseUrl } = useRuntimeConfig();
  const db = openDatabase(databaseUrl);
  setMemoisedDb(db);
  return db;
}
