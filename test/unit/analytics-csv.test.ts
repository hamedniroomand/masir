import { describe, expect, it } from 'vitest';
import {
  buildAnalyticsCsvRows,
  compareMetrics,
  labelCountBreakdowns,
  metaMetrics,
  topLinkRows,
} from '#server/utils/analytics-csv';
import { parseCsv, toCsv } from '#shared/csv';

describe('buildAnalyticsCsvRows', () => {
  it('emits a definition header then a series section', () => {
    const rows = buildAnalyticsCsvRows({
      metrics: [
        { key: 'periodClicks', value: 3 },
        { key: 'uniqueVisitors', value: 2 },
      ],
      series: [
        { bucket: '2026-09-01T00:00:00.000Z', count: 1 },
        { bucket: '2026-09-02T00:00:00.000Z', count: 2 },
      ],
    });

    expect(rows[0]).toEqual(['key', 'label', 'definition', 'value']);
    expect(rows[1]?.[0]).toBe('periodClicks');
    expect(rows[1]?.[1]).toBe('Clicks in period');
    expect(String(rows[1]?.[2])).toContain('Successful human redirects');
    expect(rows[1]?.[3]).toBe(3);
    expect(rows).toContainEqual([]);
    const seriesAt = rows.findIndex(row => row[0] === 'bucket' && row[1] === 'count');
    expect(seriesAt).toBeGreaterThan(0);
    expect(rows[seriesAt + 1]).toEqual(['2026-09-01T00:00:00.000Z', 1]);
    expect(rows[seriesAt + 2]).toEqual(['2026-09-02T00:00:00.000Z', 2]);
  });

  it('appends breakdown and top-link sections when present', () => {
    const rows = buildAnalyticsCsvRows({
      metrics: [{ key: 'periodClicks', value: 3 }],
      series: [{ bucket: '2026-09-01T00:00:00.000Z', count: 3 }],
      breakdowns: labelCountBreakdowns({
        referrer: [{ label: 'direct', count: 2 }],
        device: [{ label: 'desktop', count: 3 }],
      }),
      topLinks: topLinkRows([
        { slug: 'launch', title: '=Offer', clicks: 3 },
        { slug: 'press', title: null, periodClicks: 1 },
      ]),
    });
    const breakdownAt = rows.findIndex(row => row[0] === 'section' && row[1] === 'label');
    expect(breakdownAt).toBeGreaterThan(0);
    expect(rows[breakdownAt + 1]).toEqual(['referrer', 'direct', 2]);
    expect(rows[breakdownAt + 2]).toEqual(['device', 'desktop', 3]);
    const topAt = rows.findIndex(row => row[0] === 'slug' && row[1] === 'title');
    expect(topAt).toBeGreaterThan(breakdownAt);
    expect(rows[topAt + 1]).toEqual(['launch', '=Offer', 3]);
    expect(rows[topAt + 2]).toEqual(['press', '', 1]);
    const body = toCsv(rows);
    expect(body).toContain('\'=Offer');
    expect(parseCsv(body).some(row => row.includes('notes'))).toBe(false);
    expect(parseCsv(body).some(row => row.includes('id'))).toBe(false);
  });

  it('prefixes formula-like cells through toCsv', () => {
    const rows = buildAnalyticsCsvRows({
      metrics: [{
        key: 'warning',
        label: 'Warning',
        definition: 'Report warning.',
        value: '=1+1',
      }],
      series: [{ bucket: '2026-09-01T00:00:00.000Z', count: 0 }],
    });
    const body = toCsv(rows);
    expect(body).toContain('\'=1+1');
    expect(parseCsv(body).some(row => row.includes('notes'))).toBe(false);
  });
});

describe('metaMetrics and compareMetrics', () => {
  it('copies range meta used by R2.9 reports', () => {
    const rows = metaMetrics({
      timezone: 'UTC',
      from: '2026-09-01',
      to: '2026-09-08',
      traffic: 'human',
      signals: ['event_write'],
      warning: 'from is before retained partitions',
    });
    expect(rows.map(row => row.key)).toEqual([
      'timezone',
      'from',
      'to',
      'traffic',
      'signals',
      'warning',
    ]);
  });

  it('adds previous and change rows when compare is present', () => {
    const rows = compareMetrics({
      previous: { clicks: 10, uniqueVisitors: 4, botRequests: 1 },
      change: { absolute: 2, percent: null },
    });
    expect(rows.find(row => row.key === 'previousClicks')?.value).toBe(10);
    expect(rows.find(row => row.key === 'changePercent')?.value).toBe('');
  });
});
