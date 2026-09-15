<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

definePageMeta({ layout: 'default' });

const route = useRoute();
const id = computed(() => route.params.id as string);
const period = ref<'24h' | '7d' | '30d' | 'all'>('7d');

const { data: link, error, refresh: refreshLink } = await useFetch<LinkItem>(() => `/api/links/${id.value}`);

const { data: analytics } = useFetch(() => `/api/links/${id.value}/analytics`, {
  query: computed(() => ({ period: period.value })),
  watch: [period],
});

const { copy, copied } = useClipboard();
const destDraft = ref('');
const saving = ref(false);

watch(link, (l) => {
  if (l)
    destDraft.value = l.destinationUrl;
}, { immediate: true });

async function saveDestination() {
  if (!link.value)
    return;
  saving.value = true;
  try {
    await $fetch(`/api/links/${link.value.id}`, {
      method: 'PATCH',
      body: { destinationUrl: destDraft.value },
    });
    await refreshLink();
  }
  finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="error" class="space-y-4">
    <UAlert title="Link not found" description="This link may have been deleted or belongs to another account." icon="i-lucide-circle-alert" color="error" variant="soft" /><UButton to="/" label="Back to my links" variant="outline" />
  </div>
  <div v-else-if="link" class="space-y-7">
    <UButton to="/" label="My links" icon="i-lucide-arrow-left" color="neutral" variant="link" class="p-0" />
    <div class="flex flex-wrap items-start justify-between gap-5">
      <div class="min-w-0 space-y-3">
        <LinkStatusBadge :link="link" :expires-at="link.expiresAt" /><h1 class="break-all text-3xl font-semibold tracking-tight text-highlighted">
          {{ link.title || link.slug }}
        </h1><a :href="link.shortUrl" target="_blank" rel="noopener noreferrer" class="block break-all text-sm text-primary hover:underline">{{ link.shortUrl }}</a>
      </div>
      <UButton :label="copied ? 'Copied' : 'Copy link'" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy(link.shortUrl)" />
    </div>
    <div class="grid items-start gap-6 xl:grid-cols-[1fr_300px]">
      <div class="min-w-0 space-y-6">
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Destination
            </h2><p class="mt-1 text-sm text-muted">
              Update where this link goes. Its short address stays the same.
            </p>
          </template>
          <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="saveDestination">
            <UInput v-model="destDraft" type="url" aria-label="Destination URL" icon="i-lucide-globe" required class="flex-1" /><UButton type="submit" label="Save changes" :loading="saving" />
          </form>
        </UCard>
        <section id="analytics" class="scroll-mt-6 space-y-5 rounded-xl border border-default bg-default p-5 sm:p-6">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold text-highlighted">
                Link activity
              </h2><p class="mt-1 text-xs text-muted">
                Understand how this link is used.
              </p>
            </div><USelect v-model="period" :items="[{ label: 'Last 24 hours', value: '24h' }, { label: 'Last 7 days', value: '7d' }, { label: 'Last 30 days', value: '30d' }, { label: 'All time', value: 'all' }]" aria-label="Analytics period" class="w-40" />
          </div>
          <template v-if="analytics">
            <div class="grid grid-cols-2 gap-5 border-y border-default py-5">
              <div>
                <p class="text-xs text-muted">
                  Clicks in this period
                </p><p class="mt-2 text-3xl font-semibold tabular-nums text-highlighted">
                  {{ analytics.periodClicks.toLocaleString() }}
                </p>
              </div><div class="border-l border-default pl-5">
                <p class="text-xs text-muted">
                  All-time clicks
                </p><p class="mt-2 text-3xl font-semibold tabular-nums text-highlighted">
                  {{ analytics.totalClicks.toLocaleString() }}
                </p>
              </div>
            </div>
            <div v-if="analytics.periodClicks === 0" class="py-9 text-center">
              <UIcon name="i-lucide-chart-no-axes-column-increasing" class="mb-3 size-7 text-muted" /><h3 class="text-sm font-medium">
                No clicks in this period
              </h3><p class="mt-2 text-sm text-muted">
                Share your short link or choose another period.
              </p>
            </div>
            <template v-else>
              <UTable :data="analytics.series.map((b: { bucket: string, count: number }) => ({ bucket: b.bucket, count: b.count }))" :columns="[{ accessorKey: 'bucket', header: 'Time' }, { accessorKey: 'count', header: 'Clicks' }]" /><div class="grid gap-6 sm:grid-cols-2">
                <BreakdownList title="Referrers" :items="analytics.topReferrers" /><BreakdownList title="Countries" :items="analytics.topCountries" /><BreakdownList title="Devices" :items="analytics.devices" /><BreakdownList title="Browsers" :items="analytics.browsers" />
              </div><p v-if="!analytics.topCountries.length" class="text-xs text-muted">
                Country data is unavailable for this deployment.
              </p>
            </template>
          </template>
        </section>
      </div>
      <UCard>
        <template #header>
          <h2 class="flex items-center gap-2 font-semibold text-highlighted">
            <UIcon name="i-lucide-qr-code" class="size-4" />Share offline
          </h2>
        </template>
        <p class="text-sm leading-6 text-muted">
          Use this QR code on printed material. It follows the same short link.
        </p>
        <div class="mx-auto my-6 w-fit rounded-xl border border-default bg-white p-3">
          <img :src="`/api/links/${link.id}/qr?format=png&size=160`" alt="QR code for short link" width="160" height="160">
        </div>
        <div class="flex justify-center gap-2">
          <UButton size="sm" label="SVG" icon="i-lucide-download" color="neutral" variant="outline" :href="`/api/links/${link.id}/qr?format=svg`" download /><UButton size="sm" label="PNG" icon="i-lucide-download" color="neutral" variant="outline" :href="`/api/links/${link.id}/qr?format=png`" download />
        </div>
      </UCard>
    </div>
  </div>
</template>
