import type { SQL } from 'drizzle-orm';
import type { AppDatabase } from '#server/database/client';
import { or } from 'drizzle-orm';
import {

  closeDatabase,
  getMemoisedDb,
  openDatabase,
  setMemoisedDb,
} from '#server/database/client';

export { type AppDatabase, closeDatabase, openDatabase };

const UNIQUE_VIOLATION = '23505';

export function anyOf(...conditions: SQL[]): SQL {
  return or(...conditions) as SQL;
}

// Postgres reports a unique constraint breach with SQLSTATE 23505. Bun puts the
// SQLSTATE in errno, not code. Drizzle wraps the driver error, so the value can
// sit further down the cause chain.
export function isUniqueViolation(failure: unknown) {
  for (let cause = failure, depth = 0; cause != null && depth < 5; depth++) {
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
  const { databaseUrl, databasePoolMax } = useRuntimeConfig();
  const db = openDatabase(databaseUrl, Number(databasePoolMax) || undefined);
  setMemoisedDb(db);
  return db;
}
