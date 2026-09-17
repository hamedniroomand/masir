import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';

export type AppDatabase = BunSQLDatabase & { $client: SQL };

let memoised: AppDatabase | null = null;

export const DEFAULT_POOL_MAX = 10;

// One pool for each instance. Many instances against one database exhaust its
// connections, so the size is configuration and not a constant.
export function openDatabase(databaseUrl: string, poolMax = DEFAULT_POOL_MAX): AppDatabase {
  return drizzle({ client: new SQL({ url: databaseUrl, max: poolMax }) });
}

export async function closeDatabase() {
  await memoised?.$client.close();
  memoised = null;
}

export function setMemoisedDb(db: AppDatabase | null) {
  memoised = db;
}

export function getMemoisedDb() {
  return memoised;
}
