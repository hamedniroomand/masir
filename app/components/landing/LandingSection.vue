<script setup lang="ts">
defineProps<{ id: string; title: string; lead: string }>();
</script>

<template>
  <section :id="id" class="scroll-mt-20 border-t border-default">
    <div class="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div class="max-w-2xl">
        <h2 class="text-3xl font-semibold tracking-[-0.02em] text-highlighted sm:text-4xl">
          {{ title }}
        </h2>
        <p class="mt-4 text-base leading-7 text-muted">
          {{ lead }}
        </p>
      </div>
      <slot />
    </div>
  </section>
</template>
