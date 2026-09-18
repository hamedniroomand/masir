<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError<{ linkState?: string; startsAt?: string | null }> }>();

const linkState = computed(() => props.error.data?.linkState);
const startsAt = computed(() => props.error.data?.startsAt);
const statusCode = computed(() => props.error.statusCode ?? 500);
const notFound = computed(() => statusCode.value === 404);

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
  if (notFound.value)
    return { icon: 'i-lucide-link-2-off', title: 'Link not found.' };
  return { icon: 'i-lucide-triangle-alert', title: 'Something went wrong.' };
});

const help = computed(() => {
  if (linkState.value === 'scheduled' && startsAt.value)
    return '';
  if (notFound.value)
    return 'Check the address, or ask the person who shared it for a new link.';
  return 'Try again in a moment. If it keeps happening, report it so we can look into it.';
});

const opensAt = computed(() => {
  if (linkState.value !== 'scheduled' || !startsAt.value)
    return null;
  const date = new Date(startsAt.value);
  return {
    iso: date.toISOString(),
    text: new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(date),
  };
});

// The visitor typed this path, so showing it back leaks nothing new.
const { pathname } = useRequestURL();
const path = pathname === '/' ? '' : pathname;

useHead({ title: () => `${meta.value.title.replace(/\.$/, '')} · Masir` });
</script>

<template>
  <NuxtLayout name="auth" plain>
    <ErrorRouteArt :icon="meta.icon" class="mb-10" />
    <p class="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
      <span>Error {{ statusCode }}</span>
      <template v-if="path">
        <span class="text-dimmed">/</span>
        <code class="rounded-md border border-default bg-default px-1.5 py-0.5 font-mono text-[11px] normal-case tracking-normal text-toned shadow-control">{{ path }}</code>
      </template>
    </p>
    <h1 class="mt-3 text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
      {{ meta.title }}
    </h1>
    <p v-if="opensAt" class="mt-3 text-sm leading-6 text-muted">
      Opens <time :datetime="opensAt.iso" class="font-medium text-toned">{{ opensAt.text }}</time>
    </p>
    <p v-else class="mt-3 max-w-[44ch] text-sm leading-6 text-muted">
      {{ help }}
    </p>
    <div class="mt-8 flex flex-wrap gap-2">
      <UButton v-if="!notFound" label="Try again" icon="i-lucide-rotate-cw" @click="clearError()" />
      <UButton to="/" label="Go to Masir" color="neutral" variant="outline" />
      <UButton to="/report" label="Report a problem" variant="ghost" />
    </div>
  </NuxtLayout>
</template>
