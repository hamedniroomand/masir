import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { hashAuthToken, newAuthToken } from '#server/utils/auth-token';

describe('newAuthToken', () => {
  it('returns a long url-safe string', () => {
    const token = newAuthToken();
    expect(token).toMatch(/^[\w-]{40,}$/);
  });

  it('returns a different value each time', () => {
    expect(newAuthToken()).not.toBe(newAuthToken());
  });
});

describe('hashAuthToken', () => {
  it('returns 32 bytes', () => {
    const hash = hashAuthToken(newAuthToken());
    expect(Buffer.isBuffer(hash)).toBe(true);
    expect(hash.length).toBe(32);
  });

  it('is stable for the same token', () => {
    const token = newAuthToken();
    expect(hashAuthToken(token)).toEqual(hashAuthToken(token));
  });

  it('differs for a different token', () => {
    expect(hashAuthToken(newAuthToken())).not.toEqual(hashAuthToken(newAuthToken()));
  });
});
