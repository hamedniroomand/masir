<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number; data?: { linkState?: string } } }>();

const linkState = computed(() => props.error?.data?.linkState);

const copy = computed(() => {
  if (linkState.value === 'disabled')
    return 'This link is currently unavailable.';
  if (linkState.value === 'expired')
    return 'This link has expired.';
  if (props.error?.statusCode === 404)
    return 'Link not found.';
  return 'Something went wrong.';
});
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
    <UIcon
      :name="linkState === 'expired' ? 'i-lucide-clock' : linkState === 'disabled' ? 'i-lucide-pause' : 'i-lucide-link-2-off'"
      class="size-10 text-muted"
      aria-hidden="true"
    />
    <h1 class="text-lg font-medium">
      {{ copy }}
    </h1>
    <NuxtLink to="/report" class="text-sm text-primary">
      Report a problem
    </NuxtLink>
  </div>
</template>
