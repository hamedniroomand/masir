import { describe, expect, it } from 'vitest';
import { normalizeWorkspaceSlug } from '#shared/workspace-slug';

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
