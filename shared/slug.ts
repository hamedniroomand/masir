import * as v from 'valibot';

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
// These guard link paths inside one workspace. RESERVED_WORKSPACE_SLUGS in
// shared/workspace-slug.ts guards subdomains. Do not merge the two.
export const RESERVED_SLUGS = new Set([
  'login',
  'logout',
  'signup',
  'register',
  'verify-email',
  'forgot-password',
  'reset-password',
  'invite',
  'workspaces',
  'dashboard',
  'api',
  'settings',
  'admin',
  'health',
  'links',
  'campaigns',
  '_nuxt',
  '__nuxt',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'report',
  'p',
  'assets',
  'uploads',
  'static',
  'well-known',
]);

export function generateSlug(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++)
    out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  return out;
}

export function normalizeSlug(input: string): string {
  return input.trim().replace(/^\//, '').toLowerCase();
}

export const slugSchema = v.pipe(
  v.string(),
  v.transform(normalizeSlug),
  v.minLength(3, 'Slug must be at least 3 characters.'),
  v.maxLength(64, 'Slug must be at most 64 characters.'),
  v.regex(/^[a-z0-9_-]+$/, 'Slug may only use lowercase letters, numbers, hyphens, and underscores.'),
  v.check(slug => !slug.startsWith('-'), 'Slug cannot start with a hyphen.'),
  v.check(slug => !slug.endsWith('-'), 'Slug cannot end with a hyphen.'),
  v.check(slug => !RESERVED_SLUGS.has(slug), 'This slug is reserved.'),
);
