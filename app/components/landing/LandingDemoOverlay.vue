<script setup lang="ts">
defineProps<{ steps: readonly string[]; current: number }>();

// The page behind keeps its scrollbar under the overlay, which would shift it.
onMounted(() => {
  document.body.style.overflow = 'hidden';
});
onBeforeUnmount(() => {
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[var(--workspace-bg)] px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Setting up your demo"
      aria-busy="true"
    >
      <BrandPattern variant="canvas" />
      <div class="w-full max-w-sm">
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
          Setting up your demo
        </h1>
        <p class="mt-2 mb-8 text-sm leading-6 text-muted">
          Your workspace is yours for 24 hours. Nothing to install, nothing to sign.
        </p>
        <LandingDemoSteps :steps="steps" :current="current" />
      </div>
    </div>
  </Teleport>
</template>
