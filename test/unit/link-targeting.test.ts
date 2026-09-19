import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { normalizeTargeting, resolveDestination, targetingSchema } from '#shared/link-targeting';

const DEFAULT = 'https://example.com/default';

function link(targeting: unknown) {
  return { destinationUrl: DEFAULT, targeting: targeting as never };
}

describe('resolveDestination', () => {
  it('prefers the country rule over the os rule', () => {
    const targeting = { os: { ios: 'https://example.com/ios' }, country: { DE: 'https://example.com/de' } };
    expect(resolveDestination(link(targeting), { os: 'ios', country: 'DE' })).toBe('https://example.com/de');
  });

  it('uses the os rule when no country rule matches', () => {
    const targeting = { os: { ios: 'https://example.com/ios' }, country: { DE: 'https://example.com/de' } };
    expect(resolveDestination(link(targeting), { os: 'ios', country: 'US' })).toBe('https://example.com/ios');
  });

  it('falls back to the destination when nothing matches', () => {
    const targeting = { os: { android: 'https://example.com/android' } };
    expect(resolveDestination(link(targeting), { os: 'desktop', country: null })).toBe(DEFAULT);
    expect(resolveDestination(link(null), { os: 'ios', country: 'DE' })).toBe(DEFAULT);
  });
});

describe('targetingSchema', () => {
  function parse(input: unknown) {
    return v.safeParse(targetingSchema, input);
  }

  it('accepts a full map', () => {
    expect(parse({ os: { ios: 'https://example.com/a' }, country: { US: 'https://example.com/b' } }).success).toBe(true);
  });

  it('refuses more than twenty countries', () => {
    const country: Record<string, string> = {};
    for (let i = 0; i < 21; i++)
      country[`C${String.fromCharCode(65 + i % 26)}`] = 'https://example.com/x';
    expect(parse({ country }).success).toBe(false);
  });

  it('refuses a lowercase country key', () => {
    expect(parse({ country: { de: 'https://example.com/de' } }).success).toBe(false);
  });

  it('refuses a destination that is not http', () => {
    expect(parse({ os: { ios: 'javascript:alert(1)' } }).success).toBe(false);
  });
});

describe('normalizeTargeting', () => {
  it('turns an empty map into null', () => {
    expect(normalizeTargeting({})).toBe(null);
    expect(normalizeTargeting({ os: {}, country: {} })).toBe(null);
    expect(normalizeTargeting(null)).toBe(null);
  });

  it('keeps a map that holds a rule', () => {
    expect(normalizeTargeting({ os: { ios: 'https://example.com/a' }, country: {} }))
      .toEqual({ os: { ios: 'https://example.com/a' } });
  });
});
