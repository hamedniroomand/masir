import { describe, expect, it } from 'vitest';
import {
  changeFrom,
  parseAnalyticsRange,
  parseUtcDate,
  previousWindow,
} from '../../shared/analytics-range';

describe('analytics-range', () => {
  it('parses UTC calendar dates and rejects invalid days', () => {
    expect(parseUtcDate('2026-09-01')).toBe(Date.UTC(2026, 8, 1));
    expect(parseUtcDate('2026-02-30')).toBeNull();
    expect(parseUtcDate('2026/09/01')).toBeNull();
  });

  it('refuses period together with from/to', () => {
    const parsed = parseAnalyticsRange({ period: '7d', from: '2026-09-01', to: '2026-09-08' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok)
      expect(parsed.reason).toMatch(/either period or from\/to/i);
  });

  it('limits a custom range to 366 days', () => {
    const parsed = parseAnalyticsRange({ from: '2025-01-01', to: '2026-01-03' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok)
      expect(parsed.reason).toMatch(/366/);
  });

  it('builds an exclusive previous window of equal length', () => {
    const fromMs = Date.UTC(2026, 8, 8);
    const toMs = Date.UTC(2026, 8, 15);
    expect(previousWindow(fromMs, toMs)).toEqual({
      fromMs: Date.UTC(2026, 8, 1),
      toMs: Date.UTC(2026, 8, 8),
    });
  });

  it('returns null percent when the previous value is zero', () => {
    expect(changeFrom(5, 0)).toEqual({ absolute: 5, percent: null });
    expect(changeFrom(8, 4)).toEqual({ absolute: 4, percent: 100 });
  });

  it('defaults period to 7d when neither period nor range is set', () => {
    const now = Date.UTC(2026, 8, 24, 12);
    const parsed = parseAnalyticsRange({}, now);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.mode).toBe('period');
      expect(parsed.period).toBe('7d');
      expect(parsed.fromMs).toBe(now - 7 * 86_400_000);
      expect(parsed.toMs).toBe(now);
    }
  });
});
