import * as v from 'valibot';
import { RESERVED_SLUGS } from '#shared/slug';

// Single-segment path that sits in front of every slug: host/{prefix}/{slug}.
// Null means the slugs sit at the root.
export const LINK_PREFIX_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export function normalizeLinkPrefix(input: string): string {
  return input.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

export const linkPrefixSchema = v.pipe(
  v.string(),
  v.transform(normalizeLinkPrefix),
  v.union([
    v.pipe(v.literal(''), v.transform(() => null)),
    v.pipe(
      v.string(),
      v.regex(LINK_PREFIX_PATTERN, 'Use 1 to 32 lowercase letters, numbers, or hyphens. It cannot start or end with a hyphen.'),
      v.check(prefix => !RESERVED_SLUGS.has(prefix), 'This path is reserved.'),
    ),
  ], 'Use 1 to 32 lowercase letters, numbers, or hyphens. It cannot start or end with a hyphen.'),
);
