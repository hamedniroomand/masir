import type { LinkTargeting } from '#shared/link-targeting';
import { normalizeTargeting } from '#shared/link-targeting';

type Ok = { ok: true; url: string };
type Fail = { ok: false; reason: string };

export function validateDestination(input: string, allowPrivate: boolean): Ok | Fail {
  if (input.length > 2048)
    return { ok: false, reason: 'URL is too long (max 2048 characters).' };

  let parsed: URL;
  try {
    parsed = new URL(input.includes('://') ? input : `https://${input}`);
  }
  catch {
    return { ok: false, reason: 'Enter a valid URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return { ok: false, reason: 'Only http and https URLs are allowed.' };

  const host = parsed.hostname.toLowerCase();
  if (!host.includes('.') && host !== 'localhost')
    return { ok: false, reason: 'Enter a valid hostname.' };

  if (!allowPrivate && isBlockedHost(host))
    return { ok: false, reason: 'Private and local addresses are not allowed.' };

  return { ok: true, url: normalizeDestination(parsed) };
}

function isBlockedHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.local'))
    return true;
  if (host === '::1')
    return true;
  if (/^fc|^fd/i.test(host))
    return true;

  const match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match)
    return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 0 || a === 127)
    return true;
  if (a === 10)
    return true;
  if (a === 172 && b >= 16 && b <= 31)
    return true;
  if (a === 192 && b === 168)
    return true;
  if (a === 169 && b === 254)
    return true;
  return false;
}

function normalizeDestination(url: URL): string {
  const scheme = url.protocol.toLowerCase();
  const host = url.hostname.toLowerCase();
  let port = url.port;
  if ((scheme === 'http:' && port === '80') || (scheme === 'https:' && port === '443'))
    port = '';
  const authority = port ? `${host}:${port}` : host;
  let pathname = url.pathname;
  if (pathname === '')
    pathname = '/';
  const bareOrigin = pathname === '/' && !url.search && !url.hash;
  if (bareOrigin && !pathname.endsWith('/'))
    pathname = '/';
  return `${scheme}//${authority}${pathname}${url.search}${url.hash}`;
}

export function destinationHostFromUrl(urlString: string): string {
  return new URL(urlString).hostname.toLowerCase();
}

// Every fallback destination follows the same two rules as the main one, and
// may never point back at the short link that would send the visitor there.
export function validateFallbackDestination(input: {
  value: string;
  label: string;
  allowPrivate: boolean;
  shortDomain: string;
  // Every address the link answers on: the primary slug and its aliases.
  slugs?: string[];
}): Ok | Fail {
  const dest = validateDestination(input.value, input.allowPrivate);
  if (!dest.ok)
    return dest;
  if (input.slugs?.some(slug => shortLinkMatchesDestination(input.shortDomain, slug, dest.url)))
    return { ok: false, reason: `${input.label} cannot point to this short link.` };
  return dest;
}

// Every rule URL follows the same rules as the main destination. The map is
// normalised first, so an empty map is stored as null.
export function validateTargeting(input: {
  targeting: LinkTargeting | null | undefined;
  allowPrivate: boolean;
  shortDomain: string;
  slugs?: string[];
}): { ok: true; targeting: LinkTargeting | null } | Fail {
  const normalized = normalizeTargeting(input.targeting);
  if (!normalized)
    return { ok: true, targeting: null };

  const checked: LinkTargeting = {};
  for (const [group, rules] of Object.entries(normalized) as [keyof LinkTargeting, Record<string, string>][]) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(rules)) {
      const dest = validateFallbackDestination({ ...input, value, label: 'Targeting destination' });
      if (!dest.ok)
        return dest;
      out[key] = dest.url;
    }
    checked[group] = out;
  }
  return { ok: true, targeting: checked };
}

export function shortLinkMatchesDestination(shortDomain: string, slug: string, destinationUrl: string): boolean {
  const base = shortDomain.replace(/\/$/, '');
  const short = new URL(`${base}/${slug}`);
  let dest: URL;
  try {
    dest = new URL(destinationUrl);
  }
  catch {
    return false;
  }
  const shortPath = short.pathname.replace(/\/$/, '') || '/';
  const destPath = dest.pathname.replace(/\/$/, '') || '/';
  return dest.hostname.toLowerCase() === short.hostname.toLowerCase() && destPath === shortPath;
}
