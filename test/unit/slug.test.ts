import { describe, expect, it } from 'vitest';
import { generateSlug, normalizeSlug, validateSlug } from '#shared/slug';

describe('slug', () => {
  it('normalises input', () => {
    expect(normalizeSlug(' /My-Link ')).toBe('my-link');
  });

  it('generates without ambiguous chars', () => {
    const slug = generateSlug(20);
    expect(slug).not.toMatch(/[0Oo1lI]/);
  });

  it('rejects short slug', () => {
    expect(validateSlug('ab').ok).toBe(false);
  });
});
