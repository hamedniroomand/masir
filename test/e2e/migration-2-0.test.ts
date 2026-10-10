import { SQL } from 'bun';
import { Buffer } from 'node:buffer';
import { cpSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureClickEventPartitions, runMigrations } from '#server/database/migrate';
import { testDatabaseUrl } from './helpers';

const TEST_DB = testDatabaseUrl('migration_2_0');
const DRIZZLE = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

// The last folder is the 2.0 migration. A copy without it builds a 1.x schema.
function oneXMigrations() {
  const folders = readdirSync(DRIZZLE, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const target = mkdtempSync(join(tmpdir(), 'masir-1x-'));
  for (const name of folders.slice(0, -1))
    cpSync(join(DRIZZLE, name), join(target, name), { recursive: true });
  return target;
}

async function freshOneXDatabase() {
  const name = new URL(TEST_DB).pathname.slice(1);
  const admin = new SQL({ url: process.env.TEST_DATABASE_URL!, max: 1 });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  }
  finally {
    await admin.close();
  }
  const client = new SQL({ url: TEST_DB, max: 1 });
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: oneXMigrations() });
  await ensureClickEventPartitions(db);
  return client;
}

async function insertUser(client: SQL, email: string) {
  const [row] = await client`insert into users (email, email_verified_at) values (${email}, now()) returning id`;
  return row.id as string;
}

async function insertWorkspace(client: SQL, slug: string, deleted: boolean) {
  const [row] = await client`insert into workspaces (slug, name, deleted_at) values (${slug}, ${slug}, ${deleted ? new Date() : null}) returning id`;
  return row.id as string;
}

async function insertLink(client: SQL, workspaceId: string, slug: string) {
  const [row] = await client`insert into links (workspace_id, slug, destination_url, destination_host) values (${workspaceId}, ${slug}, 'https://example.com', 'example.com') returning id`;
  return row.id as string;
}

describe('2.0 migration', () => {
  let client: SQL;

  beforeEach(async () => {
    client = await freshOneXDatabase();
  });

  it('stops and changes nothing when two live workspaces exist', async () => {
    await insertWorkspace(client, 'one', false);
    await insertWorkspace(client, 'two', false);
    await client.close();

    await expect(runMigrations(TEST_DB)).rejects.toThrow(/serves one workspace/);

    const check = new SQL({ url: TEST_DB, max: 1 });
    const [{ count }] = await check`select count(*)::int as count from workspaces`;
    const columns = await check`select column_name from information_schema.columns where table_name = 'workspaces' and column_name = 'plan'`;
    await check.close();
    expect(count).toBe(2);
    expect(columns).toHaveLength(1);
  });

  it('keeps live data and removes what 2.0 no longer uses', async () => {
    const userId = await insertUser(client, 'owner@example.com');
    const live = await insertWorkspace(client, 'live', false);
    const gone = await insertWorkspace(client, 'gone', true);
    await client`insert into workspace_members (workspace_id, user_id, role) values (${live}, ${userId}, 'owner')`;
    await insertLink(client, live, 'keep');
    const goneLink = await insertLink(client, gone, 'drop');
    // click_events and link_daily_stats have no foreign key, so the purge must delete them.
    await client`insert into click_events (workspace_id, link_id, outcome, device, browser, is_bot) values (${gone}, ${goneLink}, 1, 1, 1, false)`;
    await client`insert into link_daily_stats (link_id, day) values (${goneLink}, current_date)`;
    await client`insert into auth_identities (user_id, provider, provider_account_id) values (${userId}, 'google', 'google-1')`;
    await client`insert into user_tokens (user_id, purpose, token_hash, expires_at) values (${userId}, 'email_verify', ${Buffer.from('a')}, now() + interval '1 day')`;
    await client.close();

    await runMigrations(TEST_DB);

    const check = new SQL({ url: TEST_DB, max: 1 });
    const workspaces = await check`select slug from workspaces`;
    const links = await check`select slug from links`;
    const clicks = await check`select 1 from click_events`;
    const stats = await check`select 1 from link_daily_stats`;
    const identities = await check`select provider from auth_identities`;
    const tokens = await check`select purpose from user_tokens`;
    const dropped = await check`
      select column_name from information_schema.columns
      where (table_name = 'workspaces' and column_name in ('plan', 'trial_started_at', 'trial_ends_at', 'subscription_status', 'expires_at', 'deleted_at'))
         or (table_name = 'users' and column_name in ('email_verified_at', 'avatar_url'))`;
    const plan = await check`select 1 from pg_type where typname = 'workspace_plan'`;
    const providers = await check`select unnest(enum_range(null::auth_provider))::text as value`;
    const purposes = await check`select unnest(enum_range(null::token_purpose))::text as value`;
    await check.close();

    expect(workspaces.map((row: { slug: string }) => row.slug)).toEqual(['live']);
    expect(links.map((row: { slug: string }) => row.slug)).toEqual(['keep']);
    expect(clicks).toHaveLength(0);
    expect(stats).toHaveLength(0);
    expect(identities).toHaveLength(0);
    expect(tokens).toHaveLength(0);
    expect(dropped).toHaveLength(0);
    expect(plan).toHaveLength(0);
    expect(providers.map((row: { value: string }) => row.value)).toEqual(['password']);
    expect(purposes.map((row: { value: string }) => row.value)).toEqual(['password_reset']);
  });
});
