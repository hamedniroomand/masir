import { describe, expect, it } from 'vitest';
import { uuidV5 } from '#server/utils/uuid-v5';
import { parseImportDate, unescapeCsvFormula } from '#shared/link-import';

describe('unescapeCsvFormula', () => {
  it('strips a leading quote from formula-like cells', () => {
    expect(unescapeCsvFormula('\'=1+1')).toBe('=1+1');
    expect(unescapeCsvFormula('\'+2')).toBe('+2');
    expect(unescapeCsvFormula('plain')).toBe('plain');
    expect(unescapeCsvFormula('\'plain')).toBe('\'plain');
  });
});

describe('parseImportDate', () => {
  it('accepts ISO 8601 with Z or an offset', () => {
    expect(parseImportDate('2026-01-01T00:00:00Z').ok).toBe(true);
    expect(parseImportDate('2026-01-01T00:00:00+03:30').ok).toBe(true);
    expect(parseImportDate('').ok).toBe(true);
    expect(parseImportDate('01/01/2026').ok).toBe(false);
  });
});

describe('uuidV5', () => {
  it('matches the RFC 4122 DNS namespace example', () => {
    // Namespace DNS, name www.example.com → 5ba9634c-... known vector.
    expect(uuidV5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'www.example.com'))
      .toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });
});
