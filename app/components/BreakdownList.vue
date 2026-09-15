<script setup lang="ts">
defineProps<{
  title: string;
  items: { label: string; count: number; percentage?: number }[];
}>();
</script>

<template>
  <div>
    <h3 class="text-sm font-medium mb-2">
      {{ title }}
    </h3>
    <ul class="space-y-1 text-sm">
      <li v-for="row in items" :key="row.label" class="flex justify-between gap-4">
        <span>{{ row.label }}</span>
        <span class="text-muted">{{ row.count }}<span v-if="row.percentage != null"> ({{ row.percentage }}%)</span></span>
      </li>
    </ul>
  </div>
</template>
