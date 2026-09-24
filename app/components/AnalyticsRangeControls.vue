<script setup lang="ts">
export type AnalyticsPeriod = '24h' | '7d' | '30d' | 'all' | 'custom';

const period = defineModel<AnalyticsPeriod>('period', { required: true });
const fromDate = defineModel<string>('fromDate', { required: true });
const toDate = defineModel<string>('toDate', { required: true });
const compare = defineModel<boolean>('compare', { required: true });

const periodItems = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All time', value: 'all' },
  { label: 'Custom range', value: 'custom' },
];
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <USelect
      v-model="period"
      :items="periodItems"
      aria-label="Analytics period"
      size="sm"
      class="w-40"
    />
    <template v-if="period === 'custom'">
      <label class="flex items-center gap-1.5 text-xs text-muted">
        <span class="sr-only">From date</span>
        <input
          v-model="fromDate"
          type="date"
          aria-label="From date"
          class="rounded-md border border-default bg-default px-2 py-1.5 text-sm text-highlighted"
        >
      </label>
      <span class="text-xs text-muted">to</span>
      <label class="flex items-center gap-1.5 text-xs text-muted">
        <span class="sr-only">To date</span>
        <input
          v-model="toDate"
          type="date"
          aria-label="To date"
          class="rounded-md border border-default bg-default px-2 py-1.5 text-sm text-highlighted"
        >
      </label>
    </template>
    <USwitch
      v-model="compare"
      size="sm"
      label="Compare previous"
      aria-label="Compare previous"
    />
  </div>
</template>
