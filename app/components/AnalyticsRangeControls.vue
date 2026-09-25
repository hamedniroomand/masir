<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date';
import { DateFormatter, getLocalTimeZone, parseDate, today } from '@internationalized/date';

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

const zone = getLocalTimeZone();
const formatter = new DateFormatter('en-US', { dateStyle: 'medium' });

const fromOpen = ref(false);
const toOpen = ref(false);
const draftFrom = shallowRef<CalendarDate>();
const draftTo = shallowRef<CalendarDate>();

const fromLabel = computed(() => {
  if (!fromDate.value)
    return 'Select';
  try {
    return formatter.format(parseDate(fromDate.value).toDate(zone));
  }
  catch {
    return fromDate.value;
  }
});

const toLabel = computed(() => {
  if (!toDate.value)
    return 'Select';
  try {
    return formatter.format(parseDate(toDate.value).toDate(zone));
  }
  catch {
    return toDate.value;
  }
});

whenever(fromOpen, () => {
  draftFrom.value = fromDate.value ? parseDate(fromDate.value) : today(zone);
});

whenever(toOpen, () => {
  draftTo.value = toDate.value ? parseDate(toDate.value) : today(zone);
});

function applyFrom() {
  if (draftFrom.value)
    fromDate.value = draftFrom.value.toString();
  fromOpen.value = false;
}

function applyTo() {
  if (draftTo.value)
    toDate.value = draftTo.value.toString();
  toOpen.value = false;
}
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
      <UPopover v-model:open="fromOpen">
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          size="sm"
          trailing-icon="i-lucide-calendar"
          aria-label="From date"
        >
          {{ fromLabel }}
        </UButton>
        <template #content>
          <div class="space-y-3 p-2">
            <UCalendar v-model="draftFrom" class="w-full" />
            <div class="flex justify-end">
              <UButton type="button" label="Done" size="sm" @click="applyFrom" />
            </div>
          </div>
        </template>
      </UPopover>
      <span class="text-xs text-muted">to</span>
      <UPopover v-model:open="toOpen">
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          size="sm"
          trailing-icon="i-lucide-calendar"
          aria-label="To date"
        >
          {{ toLabel }}
        </UButton>
        <template #content>
          <div class="space-y-3 p-2">
            <UCalendar v-model="draftTo" class="w-full" />
            <div class="flex justify-end">
              <UButton type="button" label="Done" size="sm" @click="applyTo" />
            </div>
          </div>
        </template>
      </UPopover>
    </template>
    <USwitch
      v-model="compare"
      size="sm"
      label="Compare previous"
      aria-label="Compare previous"
    />
  </div>
</template>
