import { sql } from 'drizzle-orm';
import { hosts } from '#server/database/schema';
import { getDb } from '#server/utils/db';

// ponytail: one Map for each process, cleared whole when it fills. A restart
// and a second instance each refill it, and the clear drops warm hosts with
// the cold ones. Upgrade path is a shared cache, or an LRU, when a profile
// says the misses cost more than the simplicity.
export const HOST_CACHE_MAX = 10_000;

const cache = new Map<string, number>();

export async function hostId(host: string): Promise<number> {
  const known = cache.get(host);
  if (known != null)
    return known;

  const db = await getDb();
  // do update, not do nothing. Only a row the statement touched comes back
  // from returning, and a conflict must still yield the existing id.
  const [row] = await db.insert(hosts)
    .values({ host })
    .onConflictDoUpdate({ target: hosts.host, set: { host: sql`excluded.host` } })
    .returning({ id: hosts.id });
  if (!row)
    throw new Error('the hosts upsert returned no row');

  if (cache.size >= HOST_CACHE_MAX)
    cache.clear();
  cache.set(host, row.id);
  return row.id;
}
