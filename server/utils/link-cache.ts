import type { ResolvedLink } from '#server/database/schema';

type CacheEntry = {
  link: ResolvedLink | null;
  expiresAtMs: number;
};

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 15_000;
const MAX_ENTRIES = 5000;

const store = new Map<string, CacheEntry>();
const order: string[] = [];

// Two workspaces may hold the same slug. A key of only the slug would serve
// one workspace's destination to another workspace's visitor.
function cacheKey(workspaceId: string, slug: string) {
  return `${workspaceId}:${slug}`;
}

function touch(key: string) {
  const idx = order.indexOf(key);
  if (idx >= 0)
    order.splice(idx, 1);
  order.push(key);
  while (order.length > MAX_ENTRIES) {
    const evict = order.shift();
    if (evict)
      store.delete(evict);
  }
}

export function getCachedLink(workspaceId: string, slug: string): ResolvedLink | null | undefined {
  const key = cacheKey(workspaceId, slug);
  const entry = store.get(key);
  if (!entry)
    return undefined;
  if (Date.now() > entry.expiresAtMs) {
    store.delete(key);
    return undefined;
  }
  touch(key);
  return entry.link;
}

export function setCachedLink(workspaceId: string, slug: string, link: ResolvedLink | null) {
  const key = cacheKey(workspaceId, slug);
  const ttl = link ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  store.set(key, { link, expiresAtMs: Date.now() + ttl });
  touch(key);
}

export function invalidateLink(workspaceId: string, slug: string) {
  forget(cacheKey(workspaceId, slug));
}

function forget(key: string) {
  store.delete(key);
  const idx = order.indexOf(key);
  if (idx >= 0)
    order.splice(idx, 1);
}

// An alias caches the same link under its own slug, so a write has to clear
// every key that holds the row, not only the primary slug.
// ponytail: O(n) scan of at most MAX_ENTRIES on each link write; upgrade path is a linkId -> keys index
export function invalidateLinkById(linkId: string) {
  for (const [key, entry] of store) {
    if (entry.link?.id === linkId)
      forget(key);
  }
}

export function invalidateAllLinks() {
  store.clear();
  order.length = 0;
}
