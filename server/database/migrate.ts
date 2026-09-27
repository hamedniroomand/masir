import type { AppDatabase } from '#server/database/client';
import { dirname, join } from 'node:path';
import { lt, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { openDatabase } from '#server/database/client';
import { userTokens } from '#server/database/schema';

// Any constant works; it only has to be the same in every instance.
const LOCK_ID = 4919001;
// A different key than LOCK_ID. ensureClickEventPartitions runs both at boot,
// under LOCK_ID, and from the scheduled job, so it needs its own lock.
const PARTITION_LOCK_ID = 4919002;
const PARTITION_MONTHS = [0, 1, 2];

export const CLICK_EVENT_PARTITIONS_JOB = 'click_event_partitions';

function monthStart(from: Date, offset: number) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + offset, 1));
}

function partitionName(start: Date) {
  const month = String(start.getUTCMonth() + 1).padStart(2, '0');
  return `click_events_${start.getUTCFullYear()}_${month}`;
}

// click_events is partitioned by month. An insert into a month with no
// partition fails, so boot and the click_event_partitions job both make this
// month and the next two.
// CREATE TABLE IF NOT EXISTS is not safe against a concurrent create of the
// same table, so the loop runs under an advisory lock instead of relying on
// IF NOT EXISTS alone.
export async function ensureClickEventPartitions(db: AppDatabase, now = new Date()) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${PARTITION_LOCK_ID})`);
    const names: string[] = [];
    for (const offset of PARTITION_MONTHS) {
      const from = monthStart(now, offset);
      const to = monthStart(now, offset + 1);
      const name = partitionName(from);
      await tx.execute(sql.raw(
        `create table if not exists "${name}" partition of click_events `
        + `for values from ('${from.toISOString()}') to ('${to.toISOString()}')`,
      ));
      names.push(name);
    }
    return names;
  });
}

// The exclusive upper bound of the newest click_events partition, read from
// pg_inherits instead of computed from `now`, so the report reflects what the
// database actually has.
export async function newestPartitionEnd(db: AppDatabase) {
  const [row] = await db.execute<{ relname: string }>(sql`
    select c.relname
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    where i.inhparent = 'click_events'::regclass
      and c.relname ~ '^click_events_[0-9]{4}_[0-9]{2}$'
    order by c.relname desc
    limit 1
  `);
  const match = row ? /^click_events_(\d{4})_(\d{2})$/.exec(row.relname) : null;
  if (!match)
    return undefined;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 1));
}

// Inclusive lower bound of the oldest click_events partition.
export async function oldestPartitionStart(db: AppDatabase) {
  const [row] = await db.execute<{ relname: string }>(sql`
    select c.relname
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    where i.inhparent = 'click_events'::regclass
      and c.relname ~ '^click_events_[0-9]{4}_[0-9]{2}$'
    order by c.relname asc
    limit 1
  `);
  const match = row ? /^click_events_(\d{4})_(\d{2})$/.exec(row.relname) : null;
  if (!match)
    return undefined;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

// db is explicit, not from getDb(), so this file stays free of the runtime
// config that scripts/migrate.ts cannot see.
export async function runClickEventPartitionSweep(db: AppDatabase, now: Date) {
  const names = await ensureClickEventPartitions(db, now);
  const partitionsReadyThrough = await newestPartitionEnd(db);
  return { count: names.length, ...(partitionsReadyThrough && { detail: { partitionsReadyThrough } }) };
}

// A single-instance deploy has no scheduler. Boot is the one moment the token
// row count can fall.
export async function purgeExpiredTokens(db: AppDatabase) {
  await db.delete(userTokens).where(lt(userTokens.expiresAt, new Date()));
}

export async function runMigrations(databaseUrl: string) {
  const db = openDatabase(databaseUrl);
  const migrationsFolder = join(dirname(Bun.fileURLToPath(import.meta.url)), '../../drizzle');
  try {
    // A rolling deploy starts the new instance before the old one stops, so two
    // can migrate at once and corrupt the migration table. The others wait here
    // and then find nothing to do.
    await db.execute(sql`select pg_advisory_lock(${LOCK_ID})`);
    try {
      await migrate(db, { migrationsFolder });
      await ensureClickEventPartitions(db);
      await purgeExpiredTokens(db);
    }
    finally {
      await db.execute(sql`select pg_advisory_unlock(${LOCK_ID})`);
    }
  }
  finally {
    await db.$client.close();
  }
}
