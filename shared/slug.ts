const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const RESERVED = new Set([
  'login',
  'logout',
  'signup',
  'dashboard',
  'api',
  'settings',
  'admin',
  'health',
  'links',
  '_nuxt',
  '__nuxt',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'report',
  'assets',
  'static',
  'well-known',
]);

export const RESERVED_SLUGS = RESERVED;

export function generateSlug(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++)
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export function normalizeSlug(input: string): string {
  return input.trim().replace(/^\//, '').toLowerCase();
}

export function validateSlug(input: string): { ok: true } | { ok: false; reason: string } {
  if (input.length < 3)
    return { ok: false, reason: 'Slug must be at least 3 characters.' };
  if (input.length > 64)
    return { ok: false, reason: 'Slug must be at most 64 characters.' };
  if (!/^[a-z0-9-_]+$/.test(input))
    return { ok: false, reason: 'Slug may only use lowercase letters, numbers, hyphens, and underscores.' };
  if (input.startsWith('-'))
    return { ok: false, reason: 'Slug cannot start with a hyphen.' };
  if (input.endsWith('-'))
    return { ok: false, reason: 'Slug cannot end with a hyphen.' };
  if (input.includes(' '))
    return { ok: false, reason: 'Slug cannot contain spaces.' };
  if (RESERVED.has(input))
    return { ok: false, reason: 'This slug is reserved.' };
  return { ok: true };
}
