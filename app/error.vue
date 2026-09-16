<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number; data?: { linkState?: string; startsAt?: string | null } } }>();

const linkState = computed(() => props.error?.data?.linkState);
const startsAt = computed(() => props.error?.data?.startsAt);

const copy = computed(() => {
  if (linkState.value === 'disabled')
    return 'This link is currently unavailable.';
  if (linkState.value === 'expired')
    return 'This link has expired.';
  if (linkState.value === 'limit_reached')
    return 'This link is no longer available.';
  if (linkState.value === 'scheduled')
    return 'This link is not available yet.';
  if (props.error?.statusCode === 404)
    return 'Link not found.';
  return 'Something went wrong.';
});

const activationText = computed(() => {
  if (linkState.value !== 'scheduled' || !startsAt.value)
    return '';
  return new Date(startsAt.value).toLocaleString();
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
    <p v-if="activationText" class="text-sm text-muted">
      Opens {{ activationText }}
    </p>
    <NuxtLink to="/report" class="text-sm text-primary">
      Report a problem
    </NuxtLink>
  </div>
</template>
