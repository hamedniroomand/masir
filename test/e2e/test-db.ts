import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '#server/database/schema';

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

function databasePath(databaseUrl: string) {
  return databaseUrl.replace(/^file:/, '');
}

export function openTestDatabase(databaseUrl: string) {
  const path = databasePath(databaseUrl);
  mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path);
  client.pragma('journal_mode = WAL');
  client.pragma('foreign_keys = ON');
  return drizzle({ client, schema });
}

export function migrateTestDatabase(databaseUrl: string) {
  const db = openTestDatabase(databaseUrl);
  migrate(db, { migrationsFolder });
}
