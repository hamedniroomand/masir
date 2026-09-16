<template>
  <div class="relative flex min-h-dvh flex-col bg-[var(--workspace-bg)]">
    <header class="flex items-center justify-between px-6 py-6 sm:px-10">
      <NuxtLink to="/" aria-label="Linkyard home">
        <AppLogo />
      </NuxtLink>
      <UColorModeButton size="sm" />
    </header>
    <main class="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
      <div class="w-full max-w-[420px] rounded-xl border border-default bg-default p-7 shadow-panel sm:p-9">
        <slot />
      </div>
    </main>
    <footer class="flex items-center justify-center gap-2 px-6 py-6 text-xs text-muted">
      <UIcon name="i-lucide-link-2" class="size-3.5" />Linkyard<span class="mx-1 text-dimmed">/</span>Your links. Your infrastructure.
    </footer>
  </div>
</template>
