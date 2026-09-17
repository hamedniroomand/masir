import type { SQL } from 'drizzle-orm';
import type { AppDatabase } from '#server/database/client';
import { or } from 'drizzle-orm';
import * as v from 'valibot';
import {

  closeDatabase,
  getMemoisedDb,
  openDatabase,
  setMemoisedDb,
} from '#server/database/client';

export { type AppDatabase, closeDatabase, openDatabase };

const UNIQUE_VIOLATION = '23505';

const uuidSchema = v.pipe(v.string(), v.uuid());

// An id from a route or a body reaches a uuid column. Postgres refuses a
// malformed value with 22P02, which would answer 500 where the route means
// "not found". Every lookup by an outside id asks this first.
export function isUuid(value: string) {
  return v.is(uuidSchema, value);
}

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
