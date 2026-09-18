<script setup lang="ts">
// plain drops the card for pages that read as a hero, such as the error page.
defineProps<{ plain?: boolean }>();
</script>

<template>
  <div class="relative isolate flex min-h-dvh flex-col bg-[var(--workspace-bg)]">
    <BrandPattern variant="canvas" />
    <header class="flex items-center justify-between px-6 py-6 sm:px-10">
      <NuxtLink to="/" aria-label="Masir home">
        <AppLogo />
      </NuxtLink>
      <UColorModeButton size="sm" />
    </header>
    <main class="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
      <div v-if="plain" class="w-full max-w-[560px]">
        <slot />
      </div>
      <div v-else class="w-full max-w-[420px] rounded-xl border border-default bg-default p-7 shadow-panel sm:p-9">
        <slot />
      </div>
    </main>
    <footer class="flex items-center justify-center gap-2 px-6 py-6 text-xs text-muted">
      <UIcon name="i-lucide-link-2" class="size-3.5" />Masir<span class="mx-1 text-dimmed">/</span>Every link has a destination.
      <span class="mx-1 text-dimmed">/</span>
      <ULink to="https://github.com/hamedniroomand/masir" target="_blank" rel="noopener" aria-label="Masir on GitHub" class="inline-flex items-center">
        <UIcon name="i-simple-icons-github" class="size-3.5" />
      </ULink>
    </footer>
  </div>
</template>
