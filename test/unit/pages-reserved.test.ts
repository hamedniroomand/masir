import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS } from '../../shared/slug';

const pagesDir = join(import.meta.dirname, '../../app/pages');

function reservedSegmentsFromPages(dir: string): Set<string> {
  const segments = new Set<string>();
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (entry.startsWith('.'))
      continue;
    if (statSync(path).isDirectory()) {
      segments.add(entry);
      continue;
    }
    if (entry.endsWith('.vue') && entry !== 'index.vue')
      segments.add(entry.replace(/\.vue$/, ''));
  }
  return segments;
}

describe('rESERVED_SLUGS vs app/pages', () => {
  it('lists every top-level page segment', () => {
    const segments = reservedSegmentsFromPages(pagesDir);
    for (const segment of segments) {
      expect(RESERVED_SLUGS.has(segment), `add "${segment}" to RESERVED_SLUGS in shared/slug.ts`).toBe(true);
    }
  });
});
