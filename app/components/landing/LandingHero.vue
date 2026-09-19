<script setup lang="ts">
defineProps<{ appUrl: string; registration: boolean }>();
</script>

<template>
  <section id="top" class="relative isolate overflow-hidden">
    <BrandPattern variant="canvas" />
    <div class="mx-auto max-w-6xl px-6 pt-16 sm:pt-24">
      <div class="mx-auto max-w-3xl text-center">
        <h1 class="text-4xl font-semibold tracking-[-0.03em] text-highlighted sm:text-5xl lg:text-6xl">
          Every link has a destination.
        </h1>
        <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted">
          Masir is a link manager your team runs on its own server. Share a short link once, then change where it goes, decide who can open it and when, and see what happened without storing a single visitor IP.
        </p>
        <div class="mt-9 flex flex-wrap items-center justify-center gap-3">
          <UButton v-if="registration" label="Create your workspace" :to="`${appUrl}/register`" external size="lg" />
          <UButton label="Sign in" :to="`${appUrl}/login`" external size="lg" :variant="registration ? 'outline' : 'solid'" :color="registration ? 'neutral' : 'primary'" />
          <UButton label="Read the install guide" to="https://hamedniroomand.github.io/masir/guide/installation" target="_blank" rel="noopener" size="lg" color="neutral" variant="ghost" />
        </div>
      </div>
      <LandingPreview class="mt-16 sm:mt-20" />
    </div>
  </section>
</template>
