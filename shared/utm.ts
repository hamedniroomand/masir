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

export function applyUtm(
  destinationUrl: string,
  utm: UtmParams,
  inboundQuery = '',
): { url: string; effective: UtmParams } {
  const entries = Object.entries(utm).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const url = (!entries.length && !inboundQuery)
    ? destinationUrl
    : (() => {
        const parsed = new URL(destinationUrl);
        for (const [key, value] of entries)
          parsed.searchParams.set(key, value);
        for (const [key, value] of new URLSearchParams(inboundQuery))
          parsed.searchParams.set(key, value);
        return parsed.toString();
      })();

  const parsed = new URL(url);
  const effective: UtmParams = {
    utm_source: parsed.searchParams.get('utm_source'),
    utm_medium: parsed.searchParams.get('utm_medium'),
    utm_campaign: parsed.searchParams.get('utm_campaign'),
    utm_term: parsed.searchParams.get('utm_term'),
    utm_content: parsed.searchParams.get('utm_content'),
  };

  return { url, effective };
}

export function buildDestination(destinationUrl: string, utm: UtmParams, inboundQuery = ''): string {
  return applyUtm(destinationUrl, utm, inboundQuery).url;
}
