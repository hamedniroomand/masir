import { describe, expect, it } from 'vitest';
import { isBot } from '#server/utils/request-meta';

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
