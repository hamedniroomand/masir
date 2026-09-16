<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number; data?: { linkState?: string; startsAt?: string | null } } }>();

const linkState = computed(() => props.error?.data?.linkState);
const startsAt = computed(() => props.error?.data?.startsAt);

const META = {
  disabled: { icon: 'i-lucide-pause', title: 'This link is currently unavailable.' },
  expired: { icon: 'i-lucide-clock', title: 'This link has expired.' },
  limit_reached: { icon: 'i-lucide-ban', title: 'This link is no longer available.' },
  scheduled: { icon: 'i-lucide-calendar-clock', title: 'This link is not available yet.' },
} as const;

const meta = computed(() => {
  const known = META[linkState.value as keyof typeof META];
  if (known)
    return known;
  if (props.error?.statusCode === 404)
    return { icon: 'i-lucide-link-2-off', title: 'Link not found.' };
  return { icon: 'i-lucide-triangle-alert', title: 'Something went wrong.' };
});

const activationText = computed(() => {
  if (linkState.value !== 'scheduled' || !startsAt.value)
    return '';
  return new Date(startsAt.value).toLocaleString();
});
</script>

<template>
  <NuxtLayout name="auth">
    <div class="mb-6 flex size-11 items-center justify-center rounded-lg border border-default bg-muted/50 text-muted shadow-control">
      <UIcon :name="meta.icon" class="size-5" aria-hidden="true" />
    </div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
      {{ meta.title }}
    </h1>
    <p v-if="activationText" class="mt-2 text-sm text-muted">
      Opens {{ activationText }}
    </p>
    <p v-else class="mt-2 text-sm text-muted">
      Check the address, or ask the person who shared it for a new link.
    </p>
    <div class="mt-7 flex flex-wrap gap-2">
      <UButton to="/" label="Go to Linkyard" color="neutral" variant="outline" size="sm" /><UButton to="/report" label="Report a problem" variant="ghost" size="sm" />
    </div>
  </NuxtLayout>
</template>
