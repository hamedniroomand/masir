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
  <div v-if="error">
    <p>Link not found.</p>
  </div>
  <div v-else-if="link" class="space-y-8">
    <div class="space-y-2">
      <LinkStatusBadge :link="link" :expires-at="link.expiresAt" />
      <h1 class="text-2xl font-semibold break-all">
        {{ link.title || link.slug }}
      </h1>
      <p class="flex flex-wrap items-center gap-2">
        <a :href="link.shortUrl" class="text-primary">{{ link.shortUrl }}</a>
        <UButton size="xs" :label="copied ? 'Copied' : 'Copy'" @click="copy(link.shortUrl)" />
      </p>
      <p class="text-sm text-muted">
        Destination:
        <a :href="link.destinationUrl" class="underline truncate">{{ link.destinationHost }}</a>
      </p>
      <p class="text-sm">
        {{ link.clickCount }} total clicks
      </p>
    </div>

    <UCard>
      <template #header>
        Edit destination
      </template>
      <div class="flex flex-col sm:flex-row gap-2">
        <UInput v-model="destDraft" class="flex-1" />
        <UButton label="Save" :loading="saving" @click="saveDestination" />
      </div>
    </UCard>

    <UCard>
      <template #header>
        QR code
      </template>
      <img :src="`/api/links/${link.id}/qr?format=png&size=160`" alt="QR code for short link" width="160" height="160">
      <div class="flex gap-2 mt-2">
        <UButton size="sm" label="Download SVG" :href="`/api/links/${link.id}/qr?format=svg`" />
        <UButton size="sm" label="Download PNG" :href="`/api/links/${link.id}/qr?format=png`" />
      </div>
    </UCard>

    <section id="analytics" class="space-y-4">
      <div class="flex flex-wrap gap-2 items-center">
        <h2 class="text-lg font-medium">
          Analytics
        </h2>
        <USelect
          v-model="period"
          :items="[
            { label: '24h', value: '24h' },
            { label: '7d', value: '7d' },
            { label: '30d', value: '30d' },
            { label: 'All', value: 'all' },
          ]"
          value-key="value"
          label-key="label"
          class="w-32"
        />
      </div>
      <div v-if="analytics && analytics.periodClicks === 0 && analytics.totalClicks === 0" class="text-muted">
        No clicks yet. Stats appear when someone uses the short link.
      </div>
      <template v-else-if="analytics">
        <p class="text-sm">
          {{ analytics.periodClicks }} clicks in period · {{ analytics.totalClicks }} all time
        </p>
        <UTable
          :data="analytics.series.map((b: { bucket: string, count: number }) => ({ bucket: b.bucket, count: b.count }))"
          :columns="[{ accessorKey: 'bucket', header: 'Time' }, { accessorKey: 'count', header: 'Clicks' }]"
        />
        <BreakdownList title="Referrers" :items="analytics.topReferrers" />
        <BreakdownList
          v-if="analytics.topCountries.length"
          title="Countries"
          :items="analytics.topCountries"
        />
        <p v-else class="text-sm text-muted">
          Country data unavailable for this deployment.
        </p>
        <BreakdownList title="Devices" :items="analytics.devices" />
        <BreakdownList title="Browsers" :items="analytics.browsers" />
      </template>
    </section>
  </div>
</template>
