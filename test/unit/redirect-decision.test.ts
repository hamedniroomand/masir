import { describe, expect, it } from 'vitest';
import { decideLimitFallback, decideRedirect } from '#shared/redirect-decision';

const DEFAULT_URL = 'https://example.com/default';
const COUNTRY_URL = 'https://example.com/de';
const OS_URL = 'https://example.com/ios';
const EXPIRED_URL = 'https://example.com/expired-target';
const LIMIT_URL = 'https://example.com/limit-target';
const SCHEDULED_URL = 'https://example.com/scheduled-target';

const baseMeta = {
  os: 'desktop' as const,
  country: 'US',
  isBot: false,
};

function makeLink(overrides: Record<string, unknown> = {}) {
  return {
    isEnabled: true,
    expiresAt: null,
    startsAt: null,
    maximumVisits: null,
    clickCount: 0,
    passwordHash: null,
    destinationUrl: DEFAULT_URL,
    targeting: null,
    expirationDestination: null,
    limitDestination: null,
    scheduledDestination: null,
    ...overrides,
  };
}

describe('decideRedirect', () => {
  it('handles disabled status', () => {
    const link = makeLink({ isEnabled: false });
    const decision = decideRedirect(link, { meta: baseMeta });
    expect(decision).toEqual({
      kind: 'block',
      outcome: 'disabled_block',
      statusCode: 404,
      linkState: 'disabled',
    });
  });

  describe('expired status', () => {
    const now = 1_000_000;
    const past = new Date(now - 1000);

    it('blocks when no fallback destination is set', () => {
      const link = makeLink({ expiresAt: past });
      const decision = decideRedirect(link, { meta: baseMeta, now });
      expect(decision).toEqual({
        kind: 'block',
        outcome: 'expired_block',
        statusCode: 404,
        linkState: 'expired',
      });
    });

    it('redirects to expirationDestination when set without consuming visit', () => {
      const link = makeLink({ expiresAt: past, expirationDestination: EXPIRED_URL });
      const decision = decideRedirect(link, { meta: baseMeta, now });
      expect(decision).toEqual({
        kind: 'redirect',
        destination: EXPIRED_URL,
        outcome: 'expired_redirect',
        rule: 'expired_fallback',
        consumesVisit: false,
      });
    });
  });

  describe('limit_reached status', () => {
    it('blocks when no limit destination is set', () => {
      const link = makeLink({ maximumVisits: 10, clickCount: 10 });
      const decision = decideRedirect(link, { meta: baseMeta });
      expect(decision).toEqual({
        kind: 'block',
        outcome: 'limit_reached',
        statusCode: 404,
        linkState: 'limit_reached',
      });
    });

    it('redirects to limitDestination when set without consuming visit', () => {
      const link = makeLink({ maximumVisits: 10, clickCount: 10, limitDestination: LIMIT_URL });
      const decision = decideRedirect(link, { meta: baseMeta });
      expect(decision).toEqual({
        kind: 'redirect',
        destination: LIMIT_URL,
        outcome: 'limit_redirect',
        rule: 'limit_fallback',
        consumesVisit: false,
      });
    });
  });

  describe('scheduled status', () => {
    const now = 1_000_000;
    const future = new Date(now + 10_000);

    it('blocks with startsAt when no scheduled destination is set', () => {
      const link = makeLink({ startsAt: future });
      const decision = decideRedirect(link, { meta: baseMeta, now });
      expect(decision).toEqual({
        kind: 'block',
        outcome: 'scheduled_block',
        statusCode: 404,
        linkState: 'scheduled',
        startsAt: future.toISOString(),
      });
    });

    it('redirects to scheduledDestination when set without consuming visit', () => {
      const link = makeLink({ startsAt: future, scheduledDestination: SCHEDULED_URL });
      const decision = decideRedirect(link, { meta: baseMeta, now });
      expect(decision).toEqual({
        kind: 'redirect',
        destination: SCHEDULED_URL,
        outcome: 'scheduled_redirect',
        rule: 'scheduled_fallback',
        consumesVisit: false,
      });
    });
  });

  describe('password gate', () => {
    const link = makeLink({ passwordHash: 'hash-value' });

    it('returns password kind when grant is absent', () => {
      const decision = decideRedirect(link, { meta: baseMeta, hasPasswordGrant: false });
      expect(decision).toEqual({ kind: 'password' });
    });

    it('proceeds to redirect when grant is valid', () => {
      const decision = decideRedirect(link, { meta: baseMeta, hasPasswordGrant: true });
      expect(decision.kind).toBe('redirect');
    });
  });

  describe('bot vs human handling', () => {
    const link = makeLink();

    it('returns bot_request outcome and does not consume visit for bot', () => {
      const decision = decideRedirect(link, {
        meta: { ...baseMeta, isBot: true },
      });
      expect(decision).toEqual({
        kind: 'redirect',
        destination: DEFAULT_URL,
        outcome: 'bot_request',
        rule: 'default',
        consumesVisit: false,
      });
    });

    it('returns redirect_success outcome and consumes visit for human', () => {
      const decision = decideRedirect(link, {
        meta: { ...baseMeta, isBot: false },
      });
      expect(decision).toEqual({
        kind: 'redirect',
        destination: DEFAULT_URL,
        outcome: 'redirect_success',
        rule: 'default',
        consumesVisit: true,
      });
    });
  });

  describe('targeting resolution', () => {
    const targeting = {
      os: { ios: OS_URL },
      country: { DE: COUNTRY_URL },
    };

    it('matches country rule when country matches', () => {
      const link = makeLink({ targeting });
      const decision = decideRedirect(link, {
        meta: { os: 'desktop', country: 'DE', isBot: false },
      });
      expect(decision).toMatchObject({
        kind: 'redirect',
        destination: COUNTRY_URL,
        rule: 'country',
      });
    });

    it('matches os rule when os matches and country does not', () => {
      const link = makeLink({ targeting });
      const decision = decideRedirect(link, {
        meta: { os: 'ios', country: 'FR', isBot: false },
      });
      expect(decision).toMatchObject({
        kind: 'redirect',
        destination: OS_URL,
        rule: 'os',
      });
    });

    it('prefers country over os when both match', () => {
      const link = makeLink({ targeting });
      const decision = decideRedirect(link, {
        meta: { os: 'ios', country: 'DE', isBot: false },
      });
      expect(decision).toMatchObject({
        kind: 'redirect',
        destination: COUNTRY_URL,
        rule: 'country',
      });
    });

    it('falls back to default destination when neither matches', () => {
      const link = makeLink({ targeting });
      const decision = decideRedirect(link, {
        meta: { os: 'android', country: 'US', isBot: false },
      });
      expect(decision).toMatchObject({
        kind: 'redirect',
        destination: DEFAULT_URL,
        rule: 'default',
      });
    });
  });
});

describe('decideLimitFallback', () => {
  it('redirects when limitDestination exists', () => {
    expect(decideLimitFallback({ limitDestination: 'https://example.com/fallback' })).toEqual({
      kind: 'redirect',
      destination: 'https://example.com/fallback',
      outcome: 'limit_redirect',
      rule: 'limit_fallback',
      consumesVisit: false,
    });
  });

  it('blocks when limitDestination is null or undefined', () => {
    expect(decideLimitFallback({ limitDestination: null })).toEqual({
      kind: 'block',
      outcome: 'limit_reached',
      statusCode: 404,
      linkState: 'limit_reached',
    });
  });
});
