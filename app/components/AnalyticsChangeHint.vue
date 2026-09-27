<script setup lang="ts">
defineProps<{
  change?: { absolute: number; percent: number | null } | null;
}>();
</script>

<template>
  <p v-if="change" class="mt-1 text-xs text-muted">
    <template v-if="change.percent == null">
      No prior data
    </template>
    <template v-else>
      {{ change.absolute > 0 ? '+' : '' }}{{ change.absolute.toLocaleString() }}
      ({{ change.percent > 0 ? '+' : '' }}{{ change.percent }}%) vs previous
    </template>
  </p>
</template>
