import { describe, expect, it } from 'vitest';
import { canLinkToUser } from '#server/utils/identity-repo';

describe('canLinkToUser', () => {
  it('links when the local email is verified', () => {
    expect(canLinkToUser({ emailVerifiedAt: new Date() }, true)).toBe(true);
  });

  it('refuses when the local email is not verified', () => {
    expect(canLinkToUser({ emailVerifiedAt: null }, true)).toBe(false);
  });

  it('refuses when the provider does not assert the email', () => {
    expect(canLinkToUser({ emailVerifiedAt: new Date() }, false)).toBe(false);
  });
});
