import type { AnalyticsPeriod } from '~/components/AnalyticsRangeControls.vue';

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function useAnalyticsRange(defaultPeriod: Exclude<AnalyticsPeriod, 'custom'> = '7d') {
  const period = ref<AnalyticsPeriod>(defaultPeriod);
  const fromDate = ref(utcDaysAgo(7));
  const toDate = ref(utcToday());
  const compare = ref(false);

  const query = computed(() => {
    const base: Record<string, string> = {};
    if (compare.value)
      base.compare = 'previous';
    if (period.value === 'custom') {
      if (fromDate.value && toDate.value) {
        base.from = fromDate.value;
        base.to = toDate.value;
      }
      return base;
    }
    base.period = period.value;
    return base;
  });

  const ready = computed(() => period.value !== 'custom' || (!!fromDate.value && !!toDate.value && fromDate.value < toDate.value));

  return { period, fromDate, toDate, compare, query, ready };
}
