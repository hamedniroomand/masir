<script setup lang="ts">
withDefaults(defineProps<{ label: string; value?: string; hint?: string; size?: 'md' | 'lg' }>(), {
  size: 'lg',
});
</script>

<template>
  <div>
    <p class="text-xs text-muted">
      {{ label }}
    </p>
    <p
      class="font-semibold tabular-nums tracking-tight text-highlighted"
      :class="size === 'lg' ? 'mt-3 text-3xl' : 'mt-2 text-2xl'"
    >
      <slot>{{ value }}</slot>
    </p>
    <p v-if="hint" class="mt-1 text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
