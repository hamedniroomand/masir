import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  normalizeWorkspaceSlug,
  RESERVED_WORKSPACE_SLUGS,
  suffixedSlug,
  workspaceSlugSchema,
} from '#shared/workspace-slug';

describe('normalizeWorkspaceSlug', () => {
  it('lowercases and trims', () => {
    expect(normalizeWorkspaceSlug('  Acme  ')).toBe('acme');
  });

  it('turns spaces and punctuation into single hyphens', () => {
    expect(normalizeWorkspaceSlug('Acme Inc.')).toBe('acme-inc');
    expect(normalizeWorkspaceSlug('Jack   Westin')).toBe('jack-westin');
  });

  it('drops leading and trailing hyphens', () => {
    expect(normalizeWorkspaceSlug('--acme--')).toBe('acme');
  });

  it('drops characters that cannot sit in a hostname', () => {
    expect(normalizeWorkspaceSlug('ac_me!')).toBe('ac-me');
  });
});

describe('workspaceSlugSchema', () => {
  function check(input: string) {
    return v.safeParse(workspaceSlugSchema, input).success;
  }

  it('accepts a plain name', () => {
    expect(check('acme')).toBe(true);
    expect(check('client-x')).toBe(true);
  });

  it('refuses a name that is too short or too long', () => {
    expect(check('ab')).toBe(false);
    expect(check('a'.repeat(64))).toBe(false);
  });

  it('refuses an underscore, because a hostname cannot hold one', () => {
    expect(check('ac_me')).toBe(false);
  });

  it('refuses every reserved subdomain from the PRD', () => {
    const reserved = [
      'www',
      'app',
      'api',
      'admin',
      'auth',
      'login',
      'signup',
      'register',
      'dashboard',
      'settings',
      'billing',
      'docs',
      'support',
      'status',
      'help',
      'cdn',
      'assets',
    ];
    for (const name of reserved)
      expect(check(name), name).toBe(false);
  });

  it('holds every reserved name in the exported set', () => {
    expect(RESERVED_WORKSPACE_SLUGS.has('www')).toBe(true);
    expect(RESERVED_WORKSPACE_SLUGS.has('acme')).toBe(false);
  });
});

describe('suffixedSlug', () => {
  it('returns the base when it is free', () => {
    expect(suffixedSlug('acme', () => false)).toBe('acme');
  });

  it('returns the first free suffix', () => {
    const used = new Set(['acme', 'acme-2', 'acme-3']);
    expect(suffixedSlug('acme', s => used.has(s))).toBe('acme-4');
  });

  it('gives up after a bounded number of tries', () => {
    expect(() => suffixedSlug('acme', () => true)).toThrow(/free/i);
  });
});
