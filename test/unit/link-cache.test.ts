import type { RedisClient } from 'bun';
import type { ResolvedLink } from '#server/database/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyRemoteInvalidation,
  broadcastInvalidation,
  closeLinkCacheClients,
  getCachedLink,
  invalidateAllLinks,
  invalidateLink,
  invalidateLinkById,
  LINK_INVALIDATE_CHANNEL,
  setCachedLink,
  setPublisherForTest,
} from '#server/utils/link-cache';
import * as serviceSignals from '#server/utils/service-signals';

function makeMockLink(id: string, slug: string): ResolvedLink {
  return {
    id,
    workspaceId: 'ws-1',
    slug,
    destinationUrl: `https://example.com/${slug}`,
    status: 'active',
    passwordHash: null,
    maximumVisits: null,
    clickCount: 0,
    startsAt: null,
    expiresAt: null,
    fallbackUrl: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    campaignId: null,
    routingRules: [],
  } as unknown as ResolvedLink;
}

describe('link-cache', () => {
  beforeEach(() => {
    invalidateAllLinks();
    setPublisherForTest(null);
    vi.restoreAllMocks();
  });

  it('stores and retrieves positive entries', () => {
    const link = makeMockLink('link-1', 'promo');
    setCachedLink('ws-1', 'promo', link);
    expect(getCachedLink('ws-1', 'promo')).toEqual(link);
    expect(getCachedLink('ws-2', 'promo')).toBeUndefined();
    expect(getCachedLink('ws-1', 'other')).toBeUndefined();
  });

  it('stores and retrieves negative (null) entries', () => {
    setCachedLink('ws-1', 'missing', null);
    expect(getCachedLink('ws-1', 'missing')).toBeNull();
  });

  it('invalidates by workspace and slug', () => {
    const link = makeMockLink('link-1', 'promo');
    setCachedLink('ws-1', 'promo', link);
    expect(getCachedLink('ws-1', 'promo')).toEqual(link);

    invalidateLink('ws-1', 'promo');
    expect(getCachedLink('ws-1', 'promo')).toBeUndefined();
  });

  it('invalidates by linkId across primary slug and aliases', () => {
    const link = makeMockLink('link-1', 'promo');
    setCachedLink('ws-1', 'promo', link);
    setCachedLink('ws-1', 'alias-1', link);
    setCachedLink('ws-1', 'other', makeMockLink('link-2', 'other'));

    invalidateLinkById('link-1');
    expect(getCachedLink('ws-1', 'promo')).toBeUndefined();
    expect(getCachedLink('ws-1', 'alias-1')).toBeUndefined();
    expect(getCachedLink('ws-1', 'other')).toBeDefined();
  });

  it('clears all links on invalidateAllLinks', () => {
    setCachedLink('ws-1', 'a', makeMockLink('1', 'a'));
    setCachedLink('ws-1', 'b', makeMockLink('2', 'b'));

    invalidateAllLinks();
    expect(getCachedLink('ws-1', 'a')).toBeUndefined();
    expect(getCachedLink('ws-1', 'b')).toBeUndefined();
  });

  it('applies remote invalidation messages', () => {
    const link = makeMockLink('link-1', 'promo');
    setCachedLink('ws-1', 'promo', link);
    setCachedLink('ws-1', 'alias-1', link);
    setCachedLink('ws-1', 'other', makeMockLink('link-2', 'other'));

    applyRemoteInvalidation({ workspaceId: 'ws-1', slug: 'other' });
    expect(getCachedLink('ws-1', 'other')).toBeUndefined();
    expect(getCachedLink('ws-1', 'promo')).toBeDefined();

    applyRemoteInvalidation({ linkId: 'link-1' });
    expect(getCachedLink('ws-1', 'promo')).toBeUndefined();
    expect(getCachedLink('ws-1', 'alias-1')).toBeUndefined();

    setCachedLink('ws-1', 'a', makeMockLink('1', 'a'));
    applyRemoteInvalidation({ all: true });
    expect(getCachedLink('ws-1', 'a')).toBeUndefined();
  });

  it('broadcasts invalidations via mock publisher', () => {
    const published: Array<{ channel: string; message: string }> = [];
    const mockPublisher = {
      publish: vi.fn().mockImplementation((channel: string, message: string) => {
        published.push({ channel, message });
        return Promise.resolve(1);
      }),
      close: vi.fn(),
    } as unknown as RedisClient;

    setPublisherForTest(mockPublisher);

    invalidateLink('ws-1', 'test');
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      LINK_INVALIDATE_CHANNEL,
      JSON.stringify({ workspaceId: 'ws-1', slug: 'test' }),
    );

    invalidateLinkById('link-99');
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      LINK_INVALIDATE_CHANNEL,
      JSON.stringify({ linkId: 'link-99' }),
    );

    invalidateAllLinks();
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      LINK_INVALIDATE_CHANNEL,
      JSON.stringify({ all: true }),
    );
  });

  it('sets degraded signal when Redis publish fails', async () => {
    const setSignalSpy = vi.spyOn(serviceSignals, 'setSignal').mockResolvedValue();
    const mockPublisher = {
      publish: vi.fn().mockRejectedValue(new Error('Connection lost')),
      close: vi.fn(),
    } as unknown as RedisClient;

    setPublisherForTest(mockPublisher);
    broadcastInvalidation({ workspaceId: 'ws-1', slug: 'fail' });

    // Allow promise rejection handler to run
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(setSignalSpy).toHaveBeenCalledWith(
      'link_cache',
      'degraded',
      expect.objectContaining({ error: 'Connection lost' }),
    );
  });

  it('closes publisher on closeLinkCacheClients', () => {
    const closeFn = vi.fn();
    setPublisherForTest({ close: closeFn } as unknown as RedisClient);
    closeLinkCacheClients();
    expect(closeFn).toHaveBeenCalled();
  });
});
