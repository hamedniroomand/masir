import * as v from 'valibot';

// These guard subdomains. RESERVED_SLUGS in shared/slug.ts guards link paths
// inside a workspace. The two lists mean different things.
export const RESERVED_WORKSPACE_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'auth',
  'login',
  'logout',
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
  'static',
  'mail',
  'smtp',
  'ftp',
  'ns1',
  'ns2',
]);

const MAXIMUM_SUFFIX = 100;

export function normalizeWorkspaceSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// The schema validates and never rewrites. A workspace address is immutable and
// public, so the user must see exactly what they asked for. Call
// normalizeWorkspaceSlug in the form to suggest a value before it is submitted.
export const workspaceSlugSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.minLength(3, 'The workspace address must be at least 3 characters.'),
  v.maxLength(63, 'The workspace address must be at most 63 characters.'),
  v.regex(/^[a-z0-9-]+$/, 'The workspace address may only use lowercase letters, numbers, and hyphens.'),
  v.check(slug => !slug.startsWith('-'), 'The workspace address cannot start with a hyphen.'),
  v.check(slug => !slug.endsWith('-'), 'The workspace address cannot end with a hyphen.'),
  v.check(slug => !RESERVED_WORKSPACE_SLUGS.has(slug), 'This workspace address is reserved.'),
);

export function suffixedSlug(base: string, taken: (slug: string) => boolean): string {
  if (!taken(base))
    return base;
  for (let suffix = 2; suffix <= MAXIMUM_SUFFIX; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!taken(candidate))
      return candidate;
  }
  throw new Error(`No free workspace address for "${base}"`);
}
