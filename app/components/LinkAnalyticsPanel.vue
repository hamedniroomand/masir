<script setup lang="ts">
const props = defineProps<{ linkId: string }>();

const period = ref<'24h' | '7d' | '30d' | 'all'>('7d');
const traffic = ref<'human' | 'bot' | 'all'>('human');

const { data: analytics } = useFetch(() => `/api/links/${props.linkId}/analytics`, {
  query: computed(() => ({ period: period.value, traffic: traffic.value })),
  watch: [period, traffic],
});

const trafficItems = [
  { label: 'Human traffic', value: 'human' },
  { label: 'Bot traffic', value: 'bot' },
  { label: 'All traffic', value: 'all' },
];

const periodItems = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All time', value: 'all' },
];

const seriesColumns = [
  { accessorKey: 'bucket', header: 'Time' },
  { accessorKey: 'count', header: 'Clicks' },
];

const legacyNote = computed(() => {
  const from = analytics.value?.classificationAvailableFrom;
  return from
    ? `available from ${new Date(from).toLocaleDateString()}`
    : 'are not available yet';
});
</script>

<template>
  <div id="analytics" class="scroll-mt-6 space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-highlighted">
          Link activity
        </h2><p class="mt-0.5 text-xs text-muted">
          Understand how this link is used.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <USelect v-model="traffic" :items="trafficItems" aria-label="Chart traffic" size="sm" class="w-40" /><USelect v-model="period" :items="periodItems" aria-label="Analytics period" size="sm" class="w-40" />
      </div>
    </div>

    <template v-if="analytics">
      <p v-if="analytics.periodCoversLegacy" class="text-xs text-muted">
        Unique visitor and bot analytics {{ legacyNote }}. Older clicks stay in the totals.
      </p>

      <div class="metric-grid" :class="analytics.maximumVisits == null ? 'lg:grid-cols-3' : 'lg:grid-cols-4'">
        <MetricStat label="Total clicks" :value="analytics.totalClicks.toLocaleString()" hint="Successful human redirects" /><MetricStat label="Unique visitors" :value="analytics.uniqueVisitors.toLocaleString()" /><MetricStat label="Bot requests" :value="analytics.botRequests.toLocaleString()" /><MetricStat
          v-if="analytics.maximumVisits != null"
          label="Remaining visits"
          :value="`${analytics.successfulVisitCount} / ${analytics.maximumVisits}`"
          hint="visits used"
        />
      </div>

      <div v-if="analytics.periodClicks === 0" class="surface bg-muted/20 py-16 text-center">
        <UIcon name="i-lucide-chart-no-axes-column-increasing" class="mb-3 size-7 text-muted" /><h3 class="text-sm font-medium">
          No clicks in this period
        </h3><p class="mt-2 text-sm text-muted">
          Share your short link or choose another period.
        </p>
      </div>
      <template v-else>
        <div class="surface px-3 pb-3 pt-5 sm:px-5">
          <p class="mb-4 text-xs font-medium text-muted">
            Clicks over time
          </p>
          <LinkClicksChart :series="analytics.series" :hourly="period === '24h'" />
        </div>
        <UCollapsible>
          <UButton label="View as table" icon="i-lucide-table" color="neutral" variant="ghost" size="xs" />
          <template #content>
            <UTable :data="analytics.series" :columns="seriesColumns" class="mt-3" />
          </template>
        </UCollapsible>
        <div class="grid gap-4 pt-2 sm:grid-cols-2">
          <BreakdownList title="Referrers" :items="analytics.topReferrers" /><BreakdownList title="Countries" :items="analytics.topCountries" /><BreakdownList title="Devices" :items="analytics.devices" /><BreakdownList title="Browsers" :items="analytics.browsers" />
        </div><p v-if="!analytics.topCountries.length" class="text-xs text-muted">
          Country data is unavailable for this deployment.
        </p>
      </template>
    </template>
  </div>
</template>
