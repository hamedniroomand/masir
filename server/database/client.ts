import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from '#server/database/schema';

export type AppDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

let memoised: AppDatabase | null = null;

function databasePath(databaseUrl: string) {
  return databaseUrl.replace(/^file:/, '');
}

function ensureParentDir(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
}

export async function openDatabase(databaseUrl: string): Promise<AppDatabase> {
  const path = databasePath(databaseUrl);
  ensureParentDir(path);

  const isBun = 'Bun' in globalThis;
  if (isBun) {
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    const client = new Database(path, { create: true });
    client.exec('PRAGMA journal_mode = WAL');
    client.exec('PRAGMA foreign_keys = ON');
    return drizzle({ client, schema });
  }

  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const client = new Database(path);
  client.pragma('journal_mode = WAL');
  client.pragma('foreign_keys = ON');
  return drizzle({ client, schema });
}

export function closeDatabase() {
  memoised = null;
}

export function setMemoisedDb(db: AppDatabase | null) {
  memoised = db;
}

export function getMemoisedDb() {
  return memoised;
}
