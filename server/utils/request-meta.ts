import type { H3Event } from 'h3';
import { getRequestHeaders } from 'h3';

export type BotCategory = 'search' | 'social_preview' | 'monitoring' | 'automation';

export type BotClassification = {
  isBot: boolean;
  botCategory: BotCategory | null;
};

export type RequestMeta = {
  referrerHost: string;
  country: string | null;
  deviceCategory: 'desktop' | 'mobile' | 'tablet' | 'other';
  browserCategory: string;
  isBot: boolean;
  botCategory: BotCategory | null;
};

// ponytail: static user-agent substring list; upgrade path is a maintained signature database
export function isBot(userAgent: string): BotClassification {
  const text = userAgent.toLowerCase();

  if (/googlebot|bingbot|yandexbot|duckduckbot|baiduspider|applebot|slurp|semrushbot|ahrefsbot/.test(text))
    return { isBot: true, botCategory: 'search' };

  if (/slackbot|twitterbot|facebookexternalhit|linkedinbot|discordbot|telegrambot|whatsapp|embedly|pinterestbot/.test(text))
    return { isBot: true, botCategory: 'social_preview' };

  if (/uptimerobot|pingdom|statuscake|datadog|newrelic/.test(text))
    return { isBot: true, botCategory: 'monitoring' };

  if (/curl\/|wget\/|python-requests|go-http-client|httpie|postman|insomnia|axios\/|node-fetch/.test(text))
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
  const text = ua.toLowerCase();
  if (/ipad|tablet/.test(text))
    return 'tablet';
  if (/mobi|iphone|android/.test(text))
    return 'mobile';
  if (/windows|macintosh|linux|cros/.test(text))
    return 'desktop';
  return 'other';
}

function browserFromUa(ua: string): string {
  const text = ua.toLowerCase();
  if (text.includes('firefox'))
    return 'Firefox';
  if (text.includes('edg/'))
    return 'Edge';
  if (text.includes('chrome') && !text.includes('edg/'))
    return 'Chrome';
  if (text.includes('safari') && !text.includes('chrome'))
    return 'Safari';
  return 'Other';
}
