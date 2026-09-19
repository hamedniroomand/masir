<template>
  <footer class="border-t border-default">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted">
      <span class="inline-flex items-center gap-2"><UIcon name="i-lucide-link-2" class="size-3.5" />Masir. Every link has a destination.</span>
      <nav class="flex items-center gap-4" aria-label="Project">
        <ULink to="https://hamedniroomand.github.io/masir/" target="_blank" rel="noopener" class="hover:text-highlighted">
          Docs
        </ULink>
        <ULink to="https://hamedniroomand.github.io/masir/reference/api" target="_blank" rel="noopener" class="hover:text-highlighted">
          API
        </ULink>
        <ULink to="https://github.com/hamedniroomand/masir" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 hover:text-highlighted">
          <UIcon name="i-simple-icons-github" class="size-3.5" />GitHub
        </ULink>
      </nav>
    </div>
  </footer>
</template>
