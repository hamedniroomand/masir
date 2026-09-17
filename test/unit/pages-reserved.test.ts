import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS } from '#shared/slug';

// Both trees put a top-level segment on the root path, so both can be shadowed
// by a link slug. server/routes holds the upload handler; app/pages holds the UI.
const pagesDir = join(import.meta.dirname, '../../app/pages');
const routesDir = join(import.meta.dirname, '../../server/routes');

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
    if (entry !== 'index.vue' && entry !== 'index.get.ts')
      segments.add(entry.replace(/\.(vue|get|post)?\.?ts$|\.vue$/, ''));
  }
  return segments;
}

describe('rESERVED_SLUGS', () => {
  it.each([['app/pages', pagesDir], ['server/routes', routesDir]])('covers every top-level segment in %s', (_name, dir) => {
    for (const segment of reservedSegmentsFromPages(dir)) {
      expect(RESERVED_SLUGS.has(segment), `add "${segment}" to RESERVED_SLUGS in shared/slug.ts`).toBe(true);
    }
  });
});
