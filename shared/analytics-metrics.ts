export type AnalyticsMetric = {
  key: string;
  label: string;
  range: 'period' | 'lifetime';
  traffic: 'human' | 'bot' | 'all';
  definition: string;
};

export const ANALYTICS_METRICS: readonly AnalyticsMetric[] = [
  {
    key: 'periodClicks',
    label: 'Clicks in period',
    range: 'period',
    traffic: 'human',
    definition: 'Successful human redirects within the selected time window.',
  },
  {
    key: 'lifetimeClicks',
    label: 'Lifetime clicks',
    range: 'lifetime',
    traffic: 'human',
    definition: 'All-time successful human redirects on this link.',
  },
  {
    key: 'totalClicks',
    label: 'Total clicks',
    range: 'lifetime',
    traffic: 'human',
    definition: 'All-time successful human redirects.',
  },
  {
    key: 'uniqueVisitors',
    label: 'Unique visitors',
    range: 'period',
    traffic: 'human',
    definition: 'Daily unique visitors within the selected time window.',
  },
  {
    key: 'botRequests',
    label: 'Bot requests',
    range: 'period',
    traffic: 'bot',
    definition: 'Automated crawler or bot requests within the selected time window.',
  },
  {
    key: 'usedVisits',
    label: 'Visits used',
    range: 'lifetime',
    traffic: 'human',
    definition: 'Successful visits counted against the maximum visit limit.',
  },
  {
    key: 'remainingVisits',
    label: 'Visits remaining',
    range: 'lifetime',
    traffic: 'human',
    definition: 'Remaining visits allowed before the limit destination takes effect.',
  },
  {
    key: 'maximumVisits',
    label: 'Maximum visits',
    range: 'lifetime',
    traffic: 'human',
    definition: 'The configured visit limit for this link.',
  },
  {
    key: 'linkCount',
    label: 'Links',
    range: 'lifetime',
    traffic: 'human',
    definition: 'Number of active links in the campaign.',
  },
] as const;

export function getMetricDefinition(key: string): AnalyticsMetric | undefined {
  return ANALYTICS_METRICS.find(metric => metric.key === key);
}
