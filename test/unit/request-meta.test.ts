import { describe, expect, it } from 'vitest';
import { browserFromUa, isBot, osFromUa } from '#server/utils/request-meta';

describe('isBot', () => {
  it('classifies Googlebot as a search crawler', () => {
    const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    expect(isBot(ua)).toEqual({ isBot: true, botCategory: 'search' });
  });

  it('classifies Slackbot as a social preview crawler', () => {
    expect(isBot('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)')).toEqual({
      isBot: true,
      botCategory: 'social_preview',
    });
  });

  it('classifies Twitterbot as a social preview crawler', () => {
    expect(isBot('Twitterbot/1.0')).toEqual({ isBot: true, botCategory: 'social_preview' });
  });

  it('classifies facebookexternalhit as a social preview crawler', () => {
    expect(isBot('facebookexternalhit/1.1')).toEqual({ isBot: true, botCategory: 'social_preview' });
  });

  it('classifies curl as automation', () => {
    expect(isBot('curl/8.4.0')).toEqual({ isBot: true, botCategory: 'automation' });
  });

  it('classifies UptimeRobot as monitoring', () => {
    expect(isBot('Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)')).toEqual({
      isBot: true,
      botCategory: 'monitoring',
    });
  });

  it('classifies Chrome as a human', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(isBot(ua)).toEqual({ isBot: false, botCategory: null });
  });
});

describe('browserFromUa', () => {
  it('returns lowercase labels from the codes module', () => {
    expect(browserFromUa('Mozilla/5.0 Firefox/130.0')).toBe('firefox');
    expect(browserFromUa('Mozilla/5.0 Chrome/120.0.0.0 Edg/120.0')).toBe('edge');
    expect(browserFromUa('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36')).toBe('chrome');
    expect(browserFromUa('Mozilla/5.0 (Macintosh) Version/17.0 Safari/605.1.15')).toBe('safari');
    expect(browserFromUa('curl/8.4.0')).toBe('other');
  });
});

describe('osFromUa', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', 'ios'],
    ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15', 'ios'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36', 'android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'desktop'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'desktop'],
    ['SomethingNobodyKnows/1.0', 'other'],
  ])('maps %s', (ua, expected) => {
    expect(osFromUa(ua)).toBe(expected);
  });
});
