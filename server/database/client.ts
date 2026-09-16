import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';

export type AppDatabase = BunSQLDatabase & { $client: SQL };

let memoised: AppDatabase | null = null;

export function openDatabase(databaseUrl: string): AppDatabase {
  return drizzle({ client: new SQL({ url: databaseUrl, max: 10 }) });
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
