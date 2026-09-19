<script setup lang="ts">
defineProps<{ appUrl: string; registration: boolean }>();

useSeoMeta({
  title: 'Masir · Every link has a destination.',
  description: 'Short links your team owns, destinations you can change after sharing, and analytics that never store a visitor IP.',
  robots: 'index, follow',
});
</script>

<template>
  <div class="relative isolate flex min-h-dvh flex-col bg-[var(--workspace-bg)]">
    <BrandPattern variant="canvas" />
    <header class="flex items-center justify-between px-6 py-6 sm:px-10">
      <AppLogo />
      <nav class="flex items-center gap-2" aria-label="Site">
        <UButton label="Docs" to="https://hamedniroomand.github.io/masir/" target="_blank" rel="noopener" color="neutral" variant="ghost" size="sm" />
        <UButton label="Sign in" :to="`${appUrl}/login`" external color="neutral" variant="outline" size="sm" />
        <UColorModeButton size="sm" />
      </nav>
    </header>
    <main class="flex flex-1 items-center justify-center px-4 py-12 sm:py-20">
      <div class="w-full max-w-2xl text-center">
        <UBadge label="Self-hosted link manager" color="neutral" variant="subtle" />
        <h1 class="mt-5 text-4xl font-semibold tracking-tight text-highlighted sm:text-5xl">
          Every link has a destination.
        </h1>
        <p class="mx-auto mt-5 max-w-xl text-base leading-7 text-muted">
          Short links your team owns. Change where a link goes after you share it. Analytics that never store a visitor IP.
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <UButton v-if="registration" label="Create account" :to="`${appUrl}/register`" external size="lg" icon="i-lucide-arrow-right" trailing />
          <UButton label="Sign in" :to="`${appUrl}/login`" external size="lg" :variant="registration ? 'outline' : 'solid'" :color="registration ? 'neutral' : 'primary'" />
        </div>
      </div>
    </main>
    <footer class="flex items-center justify-center gap-2 px-6 py-6 text-xs text-muted">
      <UIcon name="i-lucide-link-2" class="size-3.5" />Masir
      <span class="mx-1 text-dimmed">/</span>
      <ULink to="https://github.com/hamedniroomand/masir" target="_blank" rel="noopener" aria-label="Masir on GitHub" class="inline-flex items-center">
        <UIcon name="i-simple-icons-github" class="size-3.5" />
      </ULink>
    </footer>
  </div>
</template>
