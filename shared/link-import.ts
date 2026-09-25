export const LINK_IMPORT_COLUMNS = [
  'slug',
  'destination_url',
  'title',
  'tags',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'starts_at',
  'expires_at',
] as const;

export type LinkImportColumn = (typeof LINK_IMPORT_COLUMNS)[number];

export const LINK_EXPORT_EXTRA_COLUMNS = [
  'short_url',
  'created_at',
  'lifetime_clicks',
] as const;

export const LINK_IMPORT_MAX_BYTES = 1_048_576;
export const LINK_IMPORT_MAX_ROWS = 1000;
export const LINK_IMPORT_TAG_SEPARATOR = '|';

export type LinkImportValues = Record<LinkImportColumn, string>;

export function emptyImportValues(): LinkImportValues {
  return {
    slug: '',
    destination_url: '',
    title: '',
    tags: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
    starts_at: '',
    expires_at: '',
  };
}

// Export prefixes formula-like cells with '. Strip that marker on import so a
// round-trip restores the original value.
const FORMULA_START = new Set(['=', '+', '-', '@', '\t', '\r']);

export function unescapeCsvFormula(value: string): string {
  if (value.length < 2 || value[0] !== '\'')
    return value;
  const second = value[1] ?? '';
  if (FORMULA_START.has(second))
    return value.slice(1);
  return value;
}

export function splitImportTags(raw: string): string[] {
  if (!raw.trim())
    return [];
  return [...new Set(raw.split(LINK_IMPORT_TAG_SEPARATOR).map(part => part.trim()).filter(Boolean))];
}

export function joinImportTags(tags: string[]): string {
  return tags.join(LINK_IMPORT_TAG_SEPARATOR);
}

export function parseImportDate(raw: string): { ok: true; date: Date | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed)
    return { ok: true, date: null };
  // ISO 8601 with offset or Z. Date.parse accepts a wider set; reject that.
  if (!/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(trimmed))
    return { ok: false, error: 'Use an ISO 8601 date with an offset or Z.' };
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime()))
    return { ok: false, error: 'Use an ISO 8601 date with an offset or Z.' };
  return { ok: true, date };
}
