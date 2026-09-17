import { describe, expect, it } from 'vitest';
import { canLinkToUser, oauthEmailOf, oauthEmailVerified } from '#server/utils/identity-repo';

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

  // mail is a directory field a tenant admin can set. A userPrincipalName
  // suffix is a domain the tenant proved it owns, and this address links an
  // identity onto an existing account.
  it('prefers userPrincipalName over mail for microsoft', () => {
    expect(oauthEmailOf('MICROSOFT', { id: '1', mail: 'ceo@victim.dev', userPrincipalName: 'c@d.dev' })).toBe('c@d.dev');
  });

  it('falls back to mail when no principal name is given', () => {
    expect(oauthEmailOf('MICROSOFT', { id: '1', mail: 'a@b.dev' })).toBe('a@b.dev');
  });

  it('returns null when no address is present', () => {
    expect(oauthEmailOf('MICROSOFT', { id: '1' })).toBeNull();
  });
});

describe('oauthEmailVerified', () => {
  it('trusts the google claim and nothing else', () => {
    expect(oauthEmailVerified('GOOGLE', { email: 'a@b.dev', email_verified: true })).toBe(true);
    expect(oauthEmailVerified('GOOGLE', { email: 'a@b.dev', email_verified: false })).toBe(false);
    expect(oauthEmailVerified('GOOGLE', { email: 'a@b.dev' })).toBe(false);
  });

  // A mail-only profile carries no proof the tenant owns that domain.
  it('needs a principal name for microsoft', () => {
    expect(oauthEmailVerified('MICROSOFT', { userPrincipalName: 'a@tenant.dev' })).toBe(true);
    expect(oauthEmailVerified('MICROSOFT', { mail: 'ceo@victim.dev' })).toBe(false);
  });
});
