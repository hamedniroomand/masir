import type { ResolvedLink } from '#server/database/schema';
import { RedisClient } from 'bun';
import { setSignal } from '#server/utils/service-signals';

export const LINK_INVALIDATE_CHANNEL = 'masir:link-invalidate';

export type LinkInvalidationMessage
  = | { workspaceId: string; slug: string }
    | { linkId: string }
    | { all: true };

type CacheEntry = {
  link: ResolvedLink | null;
  expiresAtMs: number;
};

const MAX_ENTRIES = 5000;

const store = new Map<string, CacheEntry>();
const order: string[] = [];
let publisher: RedisClient | null = null;

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

function getCacheConfig() {
  try {
    const config = useRuntimeConfig();
    const ttlSeconds = config.linkCacheTtlSeconds !== undefined ? Number(config.linkCacheTtlSeconds) : 60;
    const missTtlSeconds = config.linkCacheMissTtlSeconds !== undefined ? Number(config.linkCacheMissTtlSeconds) : 15;
    return {
      positiveTtlMs: Math.max(0, ttlSeconds) * 1000,
      negativeTtlMs: Math.max(0, missTtlSeconds) * 1000,
      sharedInvalidation: Boolean(config.linkCacheSharedInvalidation),
      redisUrl: typeof config.redisUrl === 'string' ? config.redisUrl : '',
    };
  }
  catch {
    return {
      positiveTtlMs: 60_000,
      negativeTtlMs: 15_000,
      sharedInvalidation: false,
      redisUrl: '',
    };
  }
}

export function getCachedLink(workspaceId: string, slug: string): ResolvedLink | null | undefined {
  const { positiveTtlMs, negativeTtlMs } = getCacheConfig();
  const key = cacheKey(workspaceId, slug);
  const entry = store.get(key);
  if (!entry)
    return undefined;
  const isPositive = entry.link !== null;
  if ((isPositive && positiveTtlMs <= 0) || (!isPositive && negativeTtlMs <= 0)) {
    store.delete(key);
    return undefined;
  }
  if (Date.now() > entry.expiresAtMs) {
    store.delete(key);
    return undefined;
  }
  touch(key);
  return entry.link;
}

export function setCachedLink(workspaceId: string, slug: string, link: ResolvedLink | null) {
  const { positiveTtlMs, negativeTtlMs } = getCacheConfig();
  const ttl = link ? positiveTtlMs : negativeTtlMs;
  if (ttl <= 0)
    return;
  const key = cacheKey(workspaceId, slug);
  store.set(key, { link, expiresAtMs: Date.now() + ttl });
  touch(key);
}

function forget(key: string) {
  store.delete(key);
  const idx = order.indexOf(key);
  if (idx >= 0)
    order.splice(idx, 1);
}

export function applyRemoteInvalidation(message: LinkInvalidationMessage) {
  if ('all' in message && message.all) {
    store.clear();
    order.length = 0;
    return;
  }
  if ('linkId' in message && message.linkId) {
    for (const [key, entry] of store) {
      if (entry.link?.id === message.linkId)
        forget(key);
    }
    return;
  }
  if ('workspaceId' in message && 'slug' in message) {
    forget(cacheKey(message.workspaceId, message.slug));
  }
}

export function getPublisherClient(): RedisClient | null {
  if (publisher)
    return publisher;
  const { sharedInvalidation, redisUrl } = getCacheConfig();
  if (!sharedInvalidation || !redisUrl)
    return null;
  try {
    publisher = new RedisClient(redisUrl);
    publisher.onclose = () => {
      publisher = null;
    };
  }
  catch (error) {
    publisher = null;
    console.error('[link-cache] failed to initialize publisher:', error);
  }
  return publisher;
}

export function setPublisherForTest(client: RedisClient | null) {
  publisher = client;
}

export function broadcastInvalidation(message: LinkInvalidationMessage): void {
  const pub = getPublisherClient();
  if (!pub)
    return;
  pub.publish(LINK_INVALIDATE_CHANNEL, JSON.stringify(message)).catch(async (error: unknown) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await setSignal('link_cache', 'degraded', { error: errorMsg, at: new Date().toISOString() });
  });
}

export function invalidateLink(workspaceId: string, slug: string) {
  forget(cacheKey(workspaceId, slug));
  broadcastInvalidation({ workspaceId, slug });
}

// An alias caches the same link under its own slug, so a write has to clear
// every key that holds the row, not only the primary slug.
// ponytail: O(n) scan of at most MAX_ENTRIES on each link write; upgrade path is a linkId -> keys index
export function invalidateLinkById(linkId: string) {
  for (const [key, entry] of store) {
    if (entry.link?.id === linkId)
      forget(key);
  }
  broadcastInvalidation({ linkId });
}

export function invalidateAllLinks() {
  store.clear();
  order.length = 0;
  broadcastInvalidation({ all: true });
}

export function closeLinkCacheClients() {
  if (publisher) {
    try {
      publisher.close();
    }
    catch {}
    publisher = null;
  }
}
