import { createRedisStore } from '#server/utils/rate-limit-redis';

export type RateLimitHit = {
  count: number;
  resetAt: number;
};

export type RateLimitStore = {
  hit: (key: string, windowMs: number) => Promise<RateLimitHit>;
};

const MAXIMUM_KEYS = 10_000;

export function createMemoryStore(): RateLimitStore {
  const buckets = new Map<string, RateLimitHit>();

  function evict(now: number) {
    if (buckets.size < MAXIMUM_KEYS)
      return;
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now)
        buckets.delete(key);
    }
  }

  return {
    async hit(key, windowMs) {
      const now = Date.now();
      evict(now);
      const entry = buckets.get(key);
      if (!entry || entry.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs };
        buckets.set(key, fresh);
        return { ...fresh };
      }
      entry.count++;
      return { ...entry };
    },
  };
}

let override: RateLimitStore | null = null;
let memoised: RateLimitStore | null = null;

export function setRateLimitStore(store: RateLimitStore | null) {
  override = store;
  memoised = null;
}

// The memory store counts inside one process. Several instances then each hold
// their own counters, so every limit is multiplied by the instance count. Set
// NUXT_REDIS_URL to share them.
export function resolveRateLimitStore(): RateLimitStore {
  if (override)
    return override;
  if (memoised)
    return memoised;

  const { redisUrl } = useRuntimeConfig();
  memoised = redisUrl ? createRedisStore(redisUrl) : createMemoryStore();
  return memoised;
}
