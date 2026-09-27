import type { H3Event } from 'h3';
import { describe, expect, it } from 'vitest';
import { csvResponse } from '#server/utils/csv-response';
import { parseCsv, toCsv } from '#shared/csv';

describe('parseCsv', () => {
  it('parses plain fields', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('"a,b",c')).toEqual([['a,b', 'c']]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  it('accepts CRLF and lone CR row endings', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseCsv('a,b\rc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('strips a leading UTF-8 BOM', () => {
    expect(parseCsv('\uFEFFa,b')).toEqual([['a', 'b']]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('"a\nb",c')).toEqual([['a\nb', 'c']]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('does not invent a trailing empty row after a final newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
  });

  it('parses 1000 rows by 10 columns under 100 ms', () => {
    const rows = Array.from({ length: 1000 }, (_, row) =>
      Array.from({ length: 10 }, (_, col) => `r${row}c${col}`));
    const text = toCsv(rows);
    const started = performance.now();
    const parsed = parseCsv(text);
    const elapsed = performance.now() - started;
    expect(parsed).toHaveLength(1000);
    expect(parsed[0]).toEqual(rows[0]);
    expect(parsed[999]).toEqual(rows[999]);
    expect(elapsed).toBeLessThan(100);
  });
});

describe('toCsv', () => {
  it('joins rows with commas and newlines', () => {
    expect(toCsv([
      ['a', 'b'],
      ['1', '2'],
    ])).toBe('a,b\n1,2');
  });

  it('quotes commas, quotes, and newlines', () => {
    expect(toCsv([['a,b', 'say "hi"', 'x\ny']])).toBe('"a,b","say ""hi""","x\ny"');
  });

  it('prefixes formula-like cells with a single quote', () => {
    expect(toCsv([['=1+1', '+2', '-3', '@sum', '\tcmd', '\rcmd']])).toBe(
      '\'=1+1,\'+2,\'-3,\'@sum,\'\tcmd,"\'\rcmd"',
    );
  });

  it('treats null and undefined as empty cells', () => {
    expect(toCsv([[null, undefined, 0, false]])).toBe(',,0,false');
  });

  it('round-trips quoted commas and escaped quotes', () => {
    const rows = [['a,b', 'say "hi"', 'plain']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('csvResponse', () => {
  it('sets CSV content headers and returns the body', () => {
    const headers = new Map<string, string>();
    const event = {
      node: {
        res: {
          setHeader(name: string, value: string) {
            headers.set(name, value);
          },
        },
      },
    } as unknown as H3Event;

    const body = csvResponse(event, 'links.csv', [['slug', 'title'], ['a', 'Hello']]);

    expect(body).toBe('slug,title\na,Hello');
    expect(headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(headers.get('Content-Disposition')).toBe('attachment; filename="links.csv"');
  });

  it('strips double quotes from the filename', () => {
    const headers = new Map<string, string>();
    const event = {
      node: {
        res: {
          setHeader(name: string, value: string) {
            headers.set(name, value);
          },
        },
      },
    } as unknown as H3Event;

    csvResponse(event, 'bad"name.csv', [['a']]);
    expect(headers.get('Content-Disposition')).toBe('attachment; filename="badname.csv"');
  });
});
