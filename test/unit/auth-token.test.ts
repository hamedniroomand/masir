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
  it('is stable for the same token', () => {
    const token = newAuthToken();
    expect(hashAuthToken(token)).toBe(hashAuthToken(token));
  });

  it('differs for a different token', () => {
    expect(hashAuthToken(newAuthToken())).not.toBe(hashAuthToken(newAuthToken()));
  });

  it('never returns the raw token', () => {
    const token = newAuthToken();
    expect(hashAuthToken(token)).not.toContain(token);
  });
});
