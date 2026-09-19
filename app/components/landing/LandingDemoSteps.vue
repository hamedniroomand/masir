<script setup lang="ts">
const props = defineProps<{ steps: readonly string[]; current: number }>();

// The brand pattern draws a link as a route between nodes. A setup step is a
// node on that route, so the rail fills as the route completes.
function stateOf(index: number) {
  if (index < props.current)
    return 'done';
  return index === props.current ? 'active' : 'pending';
}
</script>

<template>
  <ol class="grid" role="status" aria-live="polite">
    <li v-for="(step, index) in steps" :key="step" class="grid grid-cols-[auto_1fr] items-start gap-x-4">
      <div class="grid justify-items-center gap-1 pt-0.5">
        <span
          class="grid size-4 place-items-center rounded-full border transition-colors duration-300"
          :class="{
            'border-primary bg-primary text-white dark:text-zinc-950': stateOf(index) === 'done',
            'border-primary bg-default': stateOf(index) === 'active',
            'border-default bg-default': stateOf(index) === 'pending',
          }"
        >
          <UIcon v-if="stateOf(index) === 'done'" name="i-lucide-check" class="size-2.5" />
          <span v-else-if="stateOf(index) === 'active'" class="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
        </span>
        <span
          v-if="index < steps.length - 1"
          class="h-8 w-px transition-colors duration-300"
          :class="index < current ? 'bg-primary' : 'bg-default'"
        />
      </div>
      <span
        class="pb-4 text-sm transition-colors duration-300"
        :class="stateOf(index) === 'pending' ? 'text-muted' : 'text-highlighted'"
      >{{ step }}</span>
    </li>
  </ol>
</template>
