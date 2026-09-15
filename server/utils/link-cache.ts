import type { Link } from '../database/schema';

interface CacheEntry {
  link: Link | null;
  expiresAtMs: number;
}

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 15_000;
const MAX_ENTRIES = 5000;

const store = new Map<string, CacheEntry>();
const order: string[] = [];

function touch(slug: string) {
  const idx = order.indexOf(slug);
  if (idx >= 0)
    order.splice(idx, 1);
  order.push(slug);
  while (order.length > MAX_ENTRIES) {
    const evict = order.shift();
    if (evict)
      store.delete(evict);
  }
}

export function getCachedLink(slug: string): Link | null | undefined {
  const entry = store.get(slug);
  if (!entry)
    return undefined;
  if (Date.now() > entry.expiresAtMs) {
    store.delete(slug);
    return undefined;
  }
  touch(slug);
  return entry.link;
}

export function setCachedLink(slug: string, link: Link | null) {
  const ttl = link ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  store.set(slug, { link, expiresAtMs: Date.now() + ttl });
  touch(slug);
}

export function invalidateLink(slug: string) {
  store.delete(slug);
}
