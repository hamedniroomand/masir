import type { AppDatabase } from '#server/database/client';
import { dirname, join } from 'node:path';
import { lt, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { openDatabase } from '#server/database/client';
import { userTokens } from '#server/database/schema';

// Any constant works; it only has to be the same in every instance.
const LOCK_ID = 4919001;

function monthStart(from: Date, offset: number) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + offset, 1));
}

function partitionName(start: Date) {
  const month = String(start.getUTCMonth() + 1).padStart(2, '0');
  return `click_events_${start.getUTCFullYear()}_${month}`;
}

// click_events is partitioned by month. An insert into a month with no
// partition fails, so every boot makes this month and the next one.
export async function ensureClickEventPartitions(db: AppDatabase, now = new Date()) {
  for (const offset of [0, 1]) {
    const from = monthStart(now, offset);
    const to = monthStart(now, offset + 1);
    await db.execute(sql.raw(
      `create table if not exists "${partitionName(from)}" partition of click_events `
      + `for values from ('${from.toISOString()}') to ('${to.toISOString()}')`,
    ));
  }
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
