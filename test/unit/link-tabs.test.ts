import { describe, expect, it } from 'vitest';
import { ANALYTICS_TAB, resolveLinkTab } from '#shared/link-tabs';

describe('resolveLinkTab', () => {
  it('keeps a known tab from the query', () => {
    expect(resolveLinkTab('settings', '')).toBe('settings');
    expect(resolveLinkTab('history', '')).toBe('history');
  });

  it('opens the analytics tab for the #analytics hash', () => {
    expect(resolveLinkTab(undefined, '#analytics')).toBe(ANALYTICS_TAB);
  });

  it('prefers an explicit tab over the hash', () => {
    expect(resolveLinkTab('settings', '#analytics')).toBe('settings');
  });

  it('falls back to overview for an unknown or missing tab', () => {
    expect(resolveLinkTab('nope', '')).toBe('overview');
    expect(resolveLinkTab(undefined, undefined)).toBe('overview');
    expect(resolveLinkTab(null, null)).toBe('overview');
  });
});
