import { SQL } from 'bun';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { ensureClickEventPartitions } from '#server/database/migrate';

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

// hosts is not here. It is an append-only dimension with no workspace scope,
// and the server process caches host -> id, so a truncate would leave the cache
// pointing at ids the database no longer holds.
const TABLES = ['job_runs', 'click_events', 'link_daily_stats', 'audit_events', 'link_tags', 'tags', 'links', 'link_imports', 'campaigns', 'mail_outbox', 'user_tokens', 'auth_identities', 'workspace_invitations', 'workspace_members', 'workspaces', 'users'];

const DATABASE_EXISTS = '42P04';

// One client for each database. A test file opens the same database many times.
const clients = new Map<string, SQL>();

function maintenanceUrl() {
  return process.env.TEST_DATABASE_URL ?? 'postgres://masir:masir@127.0.0.1:5432/masir_test';
}

export function testDatabaseUrl(name: string) {
  const url = new URL(maintenanceUrl());
  url.pathname = `/masir_test_${name.replace(/-/g, '_')}`;
  return url.toString();
}

export function openTestDatabase(databaseUrl: string) {
  let client = clients.get(databaseUrl);
  if (!client) {
    client = new SQL({ url: databaseUrl, max: 2 });
    clients.set(databaseUrl, client);
  }
  return drizzle({ client });
}

export async function closeTestDatabases() {
  await Promise.all([...clients.values()].map(client => client.close()));
  clients.clear();
}

export async function createTestDatabase(databaseUrl: string) {
  const name = new URL(databaseUrl).pathname.slice(1);
  let existed = false;
  const admin = new SQL({ url: maintenanceUrl(), max: 1 });
  try {
    // CREATE DATABASE forces a checkpoint. Test files run together, so the lock
    // keeps the cluster from queueing ten checkpoints at once. The database stays
    // between runs. truncateTestDatabase gives the isolation.
    await admin`select pg_advisory_lock(4242)`;
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  }
  catch (error) {
    if (String((error as { errno?: unknown }).errno) !== DATABASE_EXISTS)
      throw error;
    existed = true;
  }
  finally {
    await admin.close();
  }
  const db = openTestDatabase(databaseUrl);
  // Rows from the last run can break a migration guard, for example the 2.0 one-workspace check.
  if (existed)
    await truncateExistingTables(db);
  await migrate(db, { migrationsFolder });
  await ensureClickEventPartitions(db);
}

// An old schema can lack some tables in TABLES. Skip the missing ones.
async function truncateExistingTables(db: ReturnType<typeof openTestDatabase>) {
  const list = TABLES.map(table => `'${table}'`).join(', ');
  await db.execute(sql.raw(`DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY[${list}] LOOP IF to_regclass('public.' || t) IS NOT NULL THEN EXECUTE 'TRUNCATE ' || t || ' CASCADE'; END IF; END LOOP; END $$`));
}

export async function truncateTestDatabase(databaseUrl: string) {
  const db = openTestDatabase(databaseUrl);
  await db.execute(sql.raw(`TRUNCATE ${TABLES.join(', ')} CASCADE`));
}
