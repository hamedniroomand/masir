import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import * as schema from '#server/database/schema';

export type AppDatabase = BunSQLDatabase<typeof schema> & { $client: SQL };

let memoised: AppDatabase | null = null;

export function openDatabase(databaseUrl: string): AppDatabase {
  return drizzle({ client: new SQL({ url: databaseUrl, max: 10 }), schema });
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
