import { describe, expect, it } from 'vitest';
import { canLinkToUser, oauthEmailOf } from '#server/utils/identity-repo';

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

describe('oauthEmailOf', () => {
  it('reads the google claim', () => {
    expect(oauthEmailOf('GOOGLE', { sub: '1', email: 'a@b.dev', email_verified: true })).toBe('a@b.dev');
  });

  it('prefers mail over userPrincipalName for microsoft', () => {
    expect(oauthEmailOf('MICROSOFT', { id: '1', mail: 'a@b.dev', userPrincipalName: 'c@d.dev' })).toBe('a@b.dev');
  });

  it('falls back to userPrincipalName', () => {
    expect(oauthEmailOf('MICROSOFT', { id: '1', mail: null, userPrincipalName: 'c@d.dev' })).toBe('c@d.dev');
  });

  it('returns null when no address is present', () => {
    expect(oauthEmailOf('MICROSOFT', { id: '1' })).toBeNull();
  });
});
