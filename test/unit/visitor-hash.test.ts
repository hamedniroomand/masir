import { describe, expect, it } from 'vitest';
import { dailyVisitorSalt, visitorHash } from '#server/utils/visitor-hash';

const SALT = 'secret:20353';
const IP = '203.0.113.9';
const UA = 'Chrome/120';

describe('visitorHash', () => {
  it('returns a bigint', () => {
    expect(typeof visitorHash(SALT, 'link-a', IP, UA)).toBe('bigint');
  });

  it('fits a signed 64 bit column', () => {
    const value = visitorHash(SALT, 'link-a', IP, UA);
    expect(value).toBeGreaterThanOrEqual(-(2n ** 63n));
    expect(value).toBeLessThan(2n ** 63n);
  });

  it('is stable for the same inputs', () => {
    expect(visitorHash(SALT, 'link-a', IP, UA)).toBe(visitorHash(SALT, 'link-a', IP, UA));
  });

  it('differs for another link', () => {
    expect(visitorHash(SALT, 'link-a', IP, UA)).not.toBe(visitorHash(SALT, 'link-b', IP, UA));
  });

  it('differs for another address and another user agent', () => {
    expect(visitorHash(SALT, 'link-a', '198.51.100.7', UA)).not.toBe(visitorHash(SALT, 'link-a', IP, UA));
    expect(visitorHash(SALT, 'link-a', IP, 'Firefox/130')).not.toBe(visitorHash(SALT, 'link-a', IP, UA));
  });
});

describe('dailyVisitorSalt', () => {
  it('carries the secret and the day number', () => {
    expect(dailyVisitorSalt('secret')).toMatch(/^secret:\d+$/);
  });
});
