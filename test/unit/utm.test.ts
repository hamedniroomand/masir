import { describe, expect, it } from 'vitest';
import { buildDestination } from '#shared/utm';

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
