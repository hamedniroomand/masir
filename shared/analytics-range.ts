export type Period = '24h' | '7d' | '30d' | 'all';

export type AnalyticsRangeQuery = {
  period?: string | string[];
  from?: string | string[];
  to?: string | string[];
  compare?: string | string[];
};

export type ParsedAnalyticsRange
  = | {
    ok: true;
    mode: 'period';
    period: Period;
    compare: boolean;
    fromMs: number | null;
    toMs: number;
  }
  | {
    ok: true;
    mode: 'range';
    period: null;
    compare: boolean;
    fromMs: number;
    toMs: number;
    fromDate: string;
    toDate: string;
  }
  | { ok: false; reason: string };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MAX_ANALYTICS_RANGE_MS = 366 * 86_400_000;

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value))
    return value[0];
  return value;
}

export function parseUtcDate(value: string): number | null {
  const match = DATE_RE.exec(value);
  if (!match)
    return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day);
  const date = new Date(utcMs);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return null;
  return utcMs;
}

export function formatUtcDate(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function periodWindow(period: Period, nowMs: number): { fromMs: number | null; toMs: number } {
  if (period === 'all')
    return { fromMs: null, toMs: nowMs };
  if (period === '24h')
    return { fromMs: nowMs - 24 * 3600_000, toMs: nowMs };
  if (period === '7d')
    return { fromMs: nowMs - 7 * 86_400_000, toMs: nowMs };
  return { fromMs: nowMs - 30 * 86_400_000, toMs: nowMs };
}

export function parseAnalyticsRange(query: AnalyticsRangeQuery, nowMs = Date.now()): ParsedAnalyticsRange {
  const fromRaw = one(query.from);
  const toRaw = one(query.to);
  const periodRaw = one(query.period);
  const compare = one(query.compare) === 'previous';
  const hasFrom = fromRaw != null && fromRaw !== '';
  const hasTo = toRaw != null && toRaw !== '';
  const hasRange = hasFrom || hasTo;
  const hasExplicitPeriod = periodRaw != null && periodRaw !== '';

  if (hasRange && hasExplicitPeriod)
    return { ok: false, reason: 'Use either period or from/to, not both.' };

  if (hasRange) {
    if (!hasFrom || !hasTo || fromRaw == null || toRaw == null)
      return { ok: false, reason: 'Provide both from and to as YYYY-MM-DD.' };
    const fromMs = parseUtcDate(fromRaw);
    const toMs = parseUtcDate(toRaw);
    if (fromMs == null || toMs == null)
      return { ok: false, reason: 'from and to must be YYYY-MM-DD.' };
    if (toMs <= fromMs)
      return { ok: false, reason: 'to must be after from.' };
    if (toMs - fromMs > MAX_ANALYTICS_RANGE_MS)
      return { ok: false, reason: 'A range cannot exceed 366 days.' };
    return {
      ok: true,
      mode: 'range',
      period: null,
      compare,
      fromMs,
      toMs,
      fromDate: fromRaw,
      toDate: toRaw,
    };
  }

  const period: Period = periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' || periodRaw === 'all'
    ? periodRaw
    : '7d';
  const { fromMs, toMs } = periodWindow(period, nowMs);
  return { ok: true, mode: 'period', period, compare, fromMs, toMs };
}

export function previousWindow(fromMs: number, toMs: number): { fromMs: number; toMs: number } {
  const duration = toMs - fromMs;
  return { fromMs: fromMs - duration, toMs: fromMs };
}

export function changeFrom(current: number, previous: number): { absolute: number; percent: number | null } {
  const absolute = current - previous;
  const percent = previous === 0 ? null : Math.round((absolute / previous) * 1000) / 10;
  return { absolute, percent };
}
