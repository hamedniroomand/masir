import type { H3Event } from 'h3';
import type { AnalyticsReadOptions } from '#server/utils/analytics';
import { parseAnalyticsRange } from '#shared/analytics-range';

export function readAnalyticsOptions(event: H3Event, extras: { traffic?: 'human' | 'bot' | 'all' } = {}): AnalyticsReadOptions {
  const query = getQuery(event);
  const parsed = parseAnalyticsRange({
    period: query.period as string | undefined,
    from: query.from as string | undefined,
    to: query.to as string | undefined,
    compare: query.compare as string | undefined,
  });
  if (!parsed.ok) {
    throw createError({
      statusCode: 422,
      statusMessage: parsed.reason,
      data: { reason: parsed.reason },
    });
  }
  if (parsed.mode === 'period') {
    return {
      mode: 'period',
      period: parsed.period,
      fromMs: parsed.fromMs,
      toMs: parsed.toMs,
      compare: parsed.compare,
      traffic: extras.traffic,
    };
  }
  return {
    mode: 'range',
    period: null,
    fromMs: parsed.fromMs,
    toMs: parsed.toMs,
    fromDate: parsed.fromDate,
    toDate: parsed.toDate,
    compare: parsed.compare,
    traffic: extras.traffic,
  };
}
