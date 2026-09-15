export interface UtmParams {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
}

export function buildDestination(destinationUrl: string, utm: UtmParams, inboundQuery = ''): string {
  const entries = Object.entries(utm).filter(([, value]) => value);
  if (!entries.length && !inboundQuery)
    return destinationUrl;

  const url = new URL(destinationUrl);
  for (const [key, value] of entries)
    url.searchParams.set(key, value!);
  for (const [key, value] of new URLSearchParams(inboundQuery))
    url.searchParams.set(key, value);
  return url.toString();
}
