<script setup lang="ts">
withDefaults(defineProps<{ icon?: string }>(), { icon: 'i-lucide-x' });
</script>

<template>
  <div class="relative aspect-[420/96] w-full max-w-[420px]">
    <svg
      viewBox="0 0 420 96"
      fill="none"
      aria-hidden="true"
      focusable="false"
      class="absolute inset-0 size-full text-primary"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 76h56a16 16 0 0 0 16-16V36a16 16 0 0 1 16-16h96" />
      <path d="M196 20h20" class="error-route-gap" />
      <path d="M256 20h20" class="error-route-gap" />
      <path d="M276 20h60a16 16 0 0 1 16 16v20a16 16 0 0 0 16 16h32" class="opacity-40" />
      <path d="m396 68 4 4-4 4" class="opacity-40" />
      <circle cx="12" cy="76" r="4" class="fill-default" />
      <circle cx="196" cy="20" r="4" class="fill-default" />
    </svg>
    <!-- 236/420 and 20/96 put the badge on the gap in the route above. -->
    <span class="absolute left-[56.19%] top-[20.83%] flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-default bg-default text-primary shadow-control">
      <UIcon :name="icon" class="size-5" />
    </span>
  </div>
</template>

<style scoped>
.error-route-gap {
  stroke-dasharray: 3 5;
}
</style>
