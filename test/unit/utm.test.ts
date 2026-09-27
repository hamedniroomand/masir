import { describe, expect, it } from 'vitest';
import { applyUtm, buildDestination, utmParamsFor } from '#shared/utm';

const NONE = {};

describe('buildDestination', () => {
  it('returns the destination untouched when nothing is applied', () => {
    const url = 'https://example.com/a?b=1+2&d=%2F#frag';
    expect(buildDestination(url, NONE)).toBe(url);
    expect(buildDestination(url, { utm_source: null }, '')).toBe(url);
  });

  it('adds utm params from the link', () => {
    const out = buildDestination('https://example.com/a', { utm_source: 'newsletter', utm_campaign: 'launch' });
    expect(out).toBe('https://example.com/a?utm_source=newsletter&utm_campaign=launch');
  });

  it('maps link-level utm fields through utmParamsFor', () => {
    expect(utmParamsFor({
      utmSource: 'x',
      utmMedium: 'email',
      utmCampaign: 'launch',
      utmTerm: 'term',
      utmContent: 'body',
    })).toEqual({
      utm_source: 'x',
      utm_medium: 'email',
      utm_campaign: 'launch',
      utm_term: 'term',
      utm_content: 'body',
    });
  });

  it('adds utm_term to the destination URL', () => {
    const out = buildDestination('https://example.com/a', {
      utm_source: 'ads',
      utm_term: 'running shoes',
      utm_content: 'cta',
    });
    expect(out).toContain('utm_term=running+shoes');
    expect(out).toContain('utm_content=cta');
  });

  it('encodes special characters in utm values', () => {
    const out = buildDestination('https://example.com/a', { utm_campaign: 'a&b=c' });
    expect(out).toBe('https://example.com/a?utm_campaign=a%26b%3Dc');
  });

  it('keeps the fragment and other query params', () => {
    const out = buildDestination('https://example.com/a?b=1#frag', { utm_source: 'x' });
    expect(out).toBe('https://example.com/a?b=1&utm_source=x#frag');
  });

  it('lets the inbound query override the link params', () => {
    const out = buildDestination('https://example.com/a', { utm_source: 'link' }, 'utm_source=inbound');
    expect(out).toBe('https://example.com/a?utm_source=inbound');
  });

  it('lets the link params override the destination own params', () => {
    const out = buildDestination('https://example.com/a?utm_source=old', { utm_source: 'new' });
    expect(out).toBe('https://example.com/a?utm_source=new');
  });

  it('passes an inbound query through when the link has no utm params', () => {
    const out = buildDestination('https://example.com/a', NONE, 'page=2&ref=blog');
    expect(out).toBe('https://example.com/a?page=2&ref=blog');
  });
});

describe('applyUtm', () => {
  it('returns both the destination url and effective utm params', () => {
    const result = applyUtm(
      'https://example.com/a?utm_source=orig',
      { utm_medium: 'cpc', utm_campaign: 'spring' },
      'utm_source=override&utm_content=banner',
    );
    expect(result.url).toContain('utm_source=override');
    expect(result.url).toContain('utm_medium=cpc');
    expect(result.url).toContain('utm_campaign=spring');
    expect(result.url).toContain('utm_content=banner');
    expect(result.effective).toEqual({
      utm_source: 'override',
      utm_medium: 'cpc',
      utm_campaign: 'spring',
      utm_term: null,
      utm_content: 'banner',
    });
  });

  it('extracts params from destination url when not overridden', () => {
    const result = applyUtm('https://example.com/a?utm_source=base', NONE);
    expect(result.effective.utm_source).toBe('base');
    expect(result.effective.utm_medium).toBeNull();
  });
});
