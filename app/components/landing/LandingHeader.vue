<script setup lang="ts">
defineProps<{ appUrl: string; registration: boolean }>();

const sections = [
  { label: 'Dashboard', to: '#dashboard' },
  { label: 'Features', to: '#features' },
  { label: 'Privacy', to: '#privacy' },
];
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-default/60 bg-[var(--workspace-bg)]/85 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
      <a href="#top" aria-label="Masir home"><AppLogo /></a>
      <nav class="hidden items-center gap-1 md:flex" aria-label="Sections">
        <UButton v-for="section in sections" :key="section.to" :label="section.label" :to="section.to" color="neutral" variant="ghost" size="sm" />
        <UButton label="Docs" to="https://hamedniroomand.github.io/masir/" target="_blank" rel="noopener" color="neutral" variant="ghost" size="sm" />
      </nav>
      <div class="flex items-center gap-2">
        <UButton label="Sign in" :to="`${appUrl}/login`" external color="neutral" variant="outline" size="sm" />
        <UButton v-if="registration" label="Create account" :to="`${appUrl}/register`" external size="sm" class="hidden sm:inline-flex" />
        <UColorModeButton size="sm" />
      </div>
    </div>
  </header>
</template>
