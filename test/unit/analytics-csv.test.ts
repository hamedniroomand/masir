import { describe, expect, it } from 'vitest';
import {
  buildAnalyticsCsvRows,
  compareMetrics,
  metaMetrics,
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
