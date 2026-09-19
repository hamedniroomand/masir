import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { linkPrefixSchema } from '#shared/link-prefix';

function parse(input: string) {
  return v.safeParse(linkPrefixSchema, input);
}

describe('link prefix', () => {
  it('normalises case and slashes', () => {
    expect(parse(' /Go/ ').output).toBe('go');
  });

  it('turns an empty input into null', () => {
    expect(parse('  ').output).toBeNull();
  });

  it('accepts one character', () => {
    expect(parse('c').output).toBe('c');
  });

  it('rejects a reserved route', () => {
    expect(parse('api').success).toBe(false);
    expect(parse('p').success).toBe(false);
  });

  it('rejects a nested path', () => {
    expect(parse('a/b').success).toBe(false);
  });

  it('rejects a hyphen at an edge', () => {
    expect(parse('-go').success).toBe(false);
    expect(parse('go-').success).toBe(false);
  });

  it('rejects more than 32 characters', () => {
    expect(parse('a'.repeat(33)).success).toBe(false);
  });
});
