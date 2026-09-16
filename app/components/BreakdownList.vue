<script setup lang="ts">
defineProps<{
  title: string;
  items: { label: string; count: number; percentage?: number }[];
}>();
</script>

<template>
  <section class="surface">
    <div class="flex items-center justify-between border-b border-default bg-muted/40 px-5 py-3.5">
      <h3 class="text-[13px] font-semibold text-highlighted">
        {{ title }}
      </h3>
      <span class="text-xs text-muted">Clicks</span>
    </div>
    <ul v-if="items.length" class="space-y-1 p-3 text-xs">
      <li v-for="row in items" :key="row.label" class="relative isolate flex min-h-9 items-center justify-between gap-4 overflow-hidden rounded px-3 py-2">
        <span v-if="row.percentage != null" class="absolute inset-y-0 left-0 -z-10 rounded bg-primary/6" :style="{ width: `${Math.min(100, Math.max(0, row.percentage))}%` }" aria-hidden="true" />
        <span class="truncate font-medium text-toned" :title="row.label">{{ row.label }}</span>
        <span class="shrink-0 tabular-nums text-highlighted">{{ row.count.toLocaleString() }}<span v-if="row.percentage != null" class="ml-3 inline-block w-10 text-right text-muted">{{ row.percentage }}%</span></span>
      </li>
    </ul>
    <p v-else class="px-5 py-8 text-center text-xs text-muted">
      No data for this period.
    </p>
  </section>
</template>
