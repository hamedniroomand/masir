<script setup lang="ts">
defineProps<{ appUrl: string; registration: boolean }>();
</script>

<template>
  <section class="border-t border-default">
    <div class="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div class="relative isolate overflow-hidden rounded-panel border border-default bg-default px-6 py-14 text-center shadow-panel sm:px-12">
        <BrandPattern variant="edges" />
        <h2 class="text-3xl font-semibold tracking-[-0.02em] text-highlighted sm:text-4xl">
          Your first link takes a minute.
        </h2>
        <p class="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
          Paste a destination, pick a slug or let Masir make one, and share it. Change your mind later without changing the link.
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <UButton v-if="registration" label="Create your workspace" :to="`${appUrl}/register`" external size="lg" />
          <UButton label="Sign in" :to="`${appUrl}/login`" external size="lg" :variant="registration ? 'outline' : 'solid'" :color="registration ? 'neutral' : 'primary'" />
        </div>
      </div>
    </div>
  </section>
</template>
