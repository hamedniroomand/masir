import type { H3Event } from 'h3';
import { getRequestHeaders } from 'h3';

export type BotCategory = 'search' | 'social_preview' | 'monitoring' | 'automation';

export interface BotClassification {
  isBot: boolean;
  botCategory: BotCategory | null;
}

export interface RequestMeta {
  referrerHost: string;
  country: string | null;
  deviceCategory: 'desktop' | 'mobile' | 'tablet' | 'other';
  browserCategory: string;
  isBot: boolean;
  botCategory: BotCategory | null;
}

// ponytail: static user-agent substring list; upgrade path is a maintained signature database
export function isBot(userAgent: string): BotClassification {
  const s = userAgent.toLowerCase();

  if (/googlebot|bingbot|yandexbot|duckduckbot|baiduspider|applebot|slurp|semrushbot|ahrefsbot/.test(s))
    return { isBot: true, botCategory: 'search' };

  if (/slackbot|twitterbot|facebookexternalhit|linkedinbot|discordbot|telegrambot|whatsapp|embedly|pinterestbot/.test(s))
    return { isBot: true, botCategory: 'social_preview' };

  if (/uptimerobot|pingdom|statuscake|datadog|newrelic/.test(s))
    return { isBot: true, botCategory: 'monitoring' };

  if (/curl\/|wget\/|python-requests|go-http-client|httpie|postman|insomnia|axios\/|node-fetch/.test(s))
    return { isBot: true, botCategory: 'automation' };

  return { isBot: false, botCategory: null };
}

export function parseRequestMeta(event: H3Event): RequestMeta {
  const headers = getRequestHeaders(event);
  const referer = headers.referer ?? headers.referrer;
  let referrerHost = 'direct';
  if (referer) {
    try {
      referrerHost = new URL(referer).hostname.toLowerCase();
    }
    catch {
      referrerHost = 'direct';
    }
  }

  const config = useRuntimeConfig();
  const geoHeader = (config.geoCountryHeader || 'cf-ipcountry').toLowerCase();
  const countryRaw = headers[geoHeader] ?? headers['x-vercel-ip-country'];
  const country = typeof countryRaw === 'string' && countryRaw.length === 2
    ? countryRaw.toUpperCase()
    : null;

  const ua = headers['user-agent'] ?? '';
  const deviceCategory = deviceFromUa(ua);
  const browserCategory = browserFromUa(ua);
  const bot = isBot(ua);

  return {
    referrerHost,
    country,
    deviceCategory,
    browserCategory,
    isBot: bot.isBot,
    botCategory: bot.botCategory,
  };
}

function deviceFromUa(ua: string): RequestMeta['deviceCategory'] {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s))
    return 'tablet';
  if (/mobi|iphone|android/.test(s))
    return 'mobile';
  if (/windows|macintosh|linux|cros/.test(s))
    return 'desktop';
  return 'other';
}

function browserFromUa(ua: string): string {
  const s = ua.toLowerCase();
  if (s.includes('firefox'))
    return 'Firefox';
  if (s.includes('edg/'))
    return 'Edge';
  if (s.includes('chrome') && !s.includes('edg/'))
    return 'Chrome';
  if (s.includes('safari') && !s.includes('chrome'))
    return 'Safari';
  return 'Other';
}
