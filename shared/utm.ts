import * as v from 'valibot';

export const utmValueSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(120, 'Use at most 120 characters.'),
);

export const optionalUtmSchema = v.optional(v.nullable(utmValueSchema));

export function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export type UtmParams = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
};

export type UtmSource = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
};

export function utmParamsFor(link: UtmSource): UtmParams {
  return {
    utm_source: link.utmSource,
    utm_medium: link.utmMedium,
    utm_campaign: link.utmCampaign,
    utm_term: link.utmTerm,
    utm_content: link.utmContent,
  };
}

export function buildDestination(destinationUrl: string, utm: UtmParams, inboundQuery = ''): string {
  const entries = Object.entries(utm).filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (!entries.length && !inboundQuery)
    return destinationUrl;

  const url = new URL(destinationUrl);
  for (const [key, value] of entries)
    url.searchParams.set(key, value);
  for (const [key, value] of new URLSearchParams(inboundQuery))
    url.searchParams.set(key, value);
  return url.toString();
}
