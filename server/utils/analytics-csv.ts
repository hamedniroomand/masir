import { getMetricDefinition } from '#shared/analytics-metrics';

export type AnalyticsCsvMetric = {
  key: string;
  value: string | number | null | undefined;
  definitionKey?: string;
  label?: string;
  definition?: string;
};

export type AnalyticsCsvSeriesPoint = {
  bucket: string;
  count: number;
};

const DEFINITION_HEADER = ['key', 'label', 'definition', 'value'] as const;
const SERIES_HEADER = ['bucket', 'count'] as const;

function metricRow(metric: AnalyticsCsvMetric): unknown[] {
  const catalog = getMetricDefinition(metric.definitionKey ?? metric.key);
  return [
    metric.key,
    metric.label ?? catalog?.label ?? metric.key,
    metric.definition ?? catalog?.definition ?? '',
    metric.value ?? '',
  ];
}

export function buildAnalyticsCsvRows(input: {
  metrics: AnalyticsCsvMetric[];
  series: AnalyticsCsvSeriesPoint[];
}): unknown[][] {
  const rows: unknown[][] = [
    [...DEFINITION_HEADER],
    ...input.metrics.map(metricRow),
    [],
    [...SERIES_HEADER],
    ...input.series.map(point => [point.bucket, point.count]),
  ];
  return rows;
}

export function compareMetrics(compare?: {
  previous?: { clicks?: number; uniqueVisitors?: number; botRequests?: number };
  change?: { absolute?: number; percent?: number | null };
}): AnalyticsCsvMetric[] {
  if (!compare?.previous && !compare?.change)
    return [];
  const rows: AnalyticsCsvMetric[] = [];
  if (compare.previous) {
    rows.push(
      {
        key: 'previousClicks',
        label: 'Previous clicks',
        definition: 'Clicks in the previous equal-length range.',
        value: compare.previous.clicks ?? '',
      },
      {
        key: 'previousUniqueVisitors',
        label: 'Previous unique visitors',
        definition: 'Unique visitors in the previous equal-length range.',
        value: compare.previous.uniqueVisitors ?? '',
      },
      {
        key: 'previousBotRequests',
        label: 'Previous bot requests',
        definition: 'Bot requests in the previous equal-length range.',
        value: compare.previous.botRequests ?? '',
      },
    );
  }
  if (compare.change) {
    rows.push(
      {
        key: 'changeAbsolute',
        label: 'Change absolute',
        definition: 'Absolute change versus the previous range.',
        value: compare.change.absolute ?? '',
      },
      {
        key: 'changePercent',
        label: 'Change percent',
        definition: 'Percent change versus the previous range. Empty when the previous value is 0.',
        value: compare.change.percent ?? '',
      },
    );
  }
  return rows;
}

export function metaMetrics(meta: Record<string, unknown> | undefined): AnalyticsCsvMetric[] {
  if (!meta)
    return [];
  const rows: AnalyticsCsvMetric[] = [];
  const push = (key: string, label: string, definition: string, value: unknown) => {
    if (value === undefined || value === null || value === '')
      return;
    rows.push({
      key,
      label,
      definition,
      value: Array.isArray(value) ? value.join('|') : String(value),
    });
  };
  push('timezone', 'Timezone', 'Report timezone.', meta.timezone);
  push('period', 'Period', 'Selected period key.', meta.period);
  push('from', 'From', 'Inclusive UTC start date (YYYY-MM-DD).', meta.from);
  push('to', 'To', 'Exclusive UTC end date (YYYY-MM-DD).', meta.to);
  push('traffic', 'Traffic', 'Traffic filter.', meta.traffic);
  push('attribution', 'Attribution', 'Campaign attribution mode.', meta.attribution);
  push('earliestEventAt', 'Earliest event', 'Oldest retained click event timestamp.', meta.earliestEventAt);
  push('signals', 'Signals', 'Operational signals active for this report.', meta.signals);
  push('warning', 'Warning', 'Report warning.', meta.warning);
  push('legacyCount', 'Legacy clicks', 'Clicks recorded before attribution existed.', meta.legacyCount);
  return rows;
}
