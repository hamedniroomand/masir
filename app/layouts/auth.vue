<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <aside class="relative hidden flex-col justify-between overflow-hidden bg-blue-950 p-12 text-white lg:flex xl:p-16">
      <NuxtLink to="/" aria-label="Linkyard home">
        <AppLogo class="text-white" />
      </NuxtLink>
      <div class="relative max-w-lg py-16">
        <div class="mb-9 flex items-center gap-3 text-blue-200">
          <UIcon name="i-lucide-link" class="size-6" /><span class="text-sm">Your company’s link workspace</span>
        </div>
        <h1 class="text-5xl font-semibold leading-tight tracking-tight xl:text-6xl">
          Short links.<br>Long-term control.
        </h1>
        <p class="mt-6 max-w-sm text-base leading-7 text-blue-200">
          A permanent home for the links your work depends on. Create, update, and measure them in one place.
        </p>
        <div class="mt-10 space-y-4 border-t border-white/15 pt-7">
          <p class="flex items-center gap-3 text-sm text-blue-100">
            <UIcon name="i-lucide-arrow-left-right" class="size-4" />Change destinations without replacing links
          </p><p class="flex items-center gap-3 text-sm text-blue-100">
            <UIcon name="i-lucide-chart-no-axes-column-increasing" class="size-4" />See how your links are used
          </p><p class="flex items-center gap-3 text-sm text-blue-100">
            <UIcon name="i-lucide-server" class="size-4" />Run it on your own infrastructure
          </p>
        </div>
      </div>
      <p class="text-xs text-blue-300">
        Self-hosted. Managed by your company.
      </p>
    </aside>
    <main class="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <UColorModeButton class="absolute right-6 top-6" />
      <NuxtLink to="/" class="mb-10 lg:hidden" aria-label="Linkyard home">
        <AppLogo />
      </NuxtLink>
      <div class="w-full max-w-sm">
        <slot />
      </div>
      <p class="mt-8 flex items-center gap-2 text-xs text-muted">
        <UIcon name="i-lucide-lock-keyhole" class="size-3.5" />Access is managed by your workspace administrator.
      </p>
    </main>
  </div>
</template>
