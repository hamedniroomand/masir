<script setup lang="ts">
import type { CampaignItem } from '~/composables/useCampaigns';

definePageMeta({ layout: 'default' });

const route = useRoute();
const id = computed(() => route.params.id as string);
const period = ref<'24h' | '7d' | '30d' | 'all'>('7d');
const editOpen = ref(false);
const deleting = ref(false);
const deleteOpen = ref(false);
const showError = useErrorToast();

const { data: campaign, error, refresh: refreshCampaign } = await useFetch<CampaignItem>(() => `/api/campaigns/${id.value}`);

const { data: analytics, refresh: refreshAnalytics } = useFetch(() => `/api/campaigns/${id.value}/analytics`, {
  query: computed(() => ({ period: period.value })),
  watch: [period],
});

useHead({ title: () => `${campaign.value?.name ?? 'Campaign'} · Linkyard` });

const topSource = computed(() => analytics.value?.bySource[0]);

async function onSaved() {
  editOpen.value = false;
  await Promise.all([refreshCampaign(), refreshAnalytics()]);
}

async function removeCampaign() {
  deleting.value = true;
  try {
    await $fetch(`/api/campaigns/${id.value}`, { method: 'DELETE' });
    await navigateTo('/campaigns');
  }
  catch (error: unknown) {
    showError(error);
  }
  finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div v-if="error" class="space-y-4">
    <UAlert title="Campaign not found" description="This campaign may have been deleted." icon="i-lucide-circle-alert" color="error" variant="soft" />
    <UButton to="/campaigns" label="Back to campaigns" variant="outline" />
  </div>
  <div v-else-if="campaign" class="space-y-5">
    <UButton to="/campaigns" label="Campaigns" icon="i-lucide-arrow-left" color="neutral" variant="link" size="sm" class="p-0" />
    <div class="page-heading">
      <div class="min-w-0">
        <h1 class="break-words text-2xl font-semibold tracking-tight text-highlighted">
          {{ campaign.name }}
        </h1>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <UBadge :label="`utm_campaign=${campaign.utmCampaign}`" color="neutral" variant="subtle" size="sm" />
          <UBadge v-if="campaign.utmMedium" :label="`utm_medium=${campaign.utmMedium}`" color="neutral" variant="subtle" size="sm" />
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <UButton label="Edit" icon="i-lucide-pencil" color="neutral" variant="outline" size="sm" @click="editOpen = true" />
        <UButton label="Delete" icon="i-lucide-trash-2" color="error" variant="outline" size="sm" @click="deleteOpen = true" />
      </div>
    </div>

    <USlideover
      v-model:open="editOpen"
      title="Edit campaign"
      description="Changes apply to every link in this campaign."
      :unmount-on-hide="false"
      :ui="{ content: 'sm:max-w-[480px]' }"
    >
      <template #body>
        <CampaignForm :campaign="campaign" @saved="onSaved" />
      </template>
    </USlideover>

    <UModal v-model:open="deleteOpen" title="Delete campaign" description="The links stay. They lose their campaign utm values.">
      <template #body>
        <p>Delete <strong>{{ campaign.name }}</strong>? Its {{ campaign.linkCount }} link(s) keep working, but they stop sending utm_campaign and utm_medium.</p>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="deleteOpen = false" />
        <UButton label="Delete campaign" color="error" :loading="deleting" @click="removeCampaign" />
      </template>
    </UModal>

    <template v-if="analytics">
      <div class="metric-grid">
        <MetricStat size="md" class="p-5" label="Clicks in this period" :value="analytics.periodClicks.toLocaleString()" />
        <MetricStat size="md" class="border-l border-default p-5" label="All-time clicks" :value="analytics.totalClicks.toLocaleString()" />
        <MetricStat size="md" class="border-t border-default p-5 lg:border-l lg:border-t-0" label="Links" :value="String(analytics.linkCount)" />
        <MetricStat size="md" class="border-l border-t border-default p-5 lg:border-t-0" label="Top source">
          <span class="block truncate" :title="topSource?.label">{{ topSource?.label ?? '—' }}</span>
        </MetricStat>
      </div>

      <section class="space-y-5 rounded-panel border border-default bg-default p-4 sm:p-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold text-highlighted">
              Campaign activity
            </h2>
            <p class="mt-1 text-xs text-muted">
              Clicks on every link in this campaign.
            </p>
          </div>
          <USelect
            v-model="period"
            :items="[{ label: 'Last 24 hours', value: '24h' }, { label: 'Last 7 days', value: '7d' }, { label: 'Last 30 days', value: '30d' }, { label: 'All time', value: 'all' }]"
            aria-label="Analytics period"
            class="w-40"
          />
        </div>
        <div v-if="analytics.periodClicks === 0" class="py-9 text-center">
          <UIcon name="i-lucide-chart-no-axes-column-increasing" class="mb-3 size-7 text-muted" />
          <h3 class="text-sm font-medium">
            No clicks in this period
          </h3>
          <p class="mt-2 text-sm text-muted">
            Share a link from this campaign or choose another period.
          </p>
        </div>
        <template v-else>
          <LinkClicksChart :series="analytics.series" :hourly="period === '24h'" />
          <div class="grid gap-4 sm:grid-cols-2">
            <BreakdownList title="Sources" :items="analytics.bySource" />
            <BreakdownList title="Referrers" :items="analytics.topReferrers" />
            <BreakdownList title="Countries" :items="analytics.topCountries" />
            <BreakdownList title="Devices" :items="analytics.devices" />
          </div>
        </template>
      </section>

      <section class="overflow-hidden rounded-panel border border-default bg-default">
        <div class="border-b border-default p-5">
          <h2 class="font-semibold text-highlighted">
            Link performance
          </h2>
          <p class="mt-1 text-xs text-muted">
            Sorted by clicks in this period.
          </p>
        </div>
        <div v-if="!analytics.topLinks.length" class="px-5 py-12 text-center text-sm text-muted">
          No links use this campaign yet.
        </div>
        <div v-else class="divide-y divide-default">
          <NuxtLink
            v-for="row in analytics.topLinks"
            :key="row.id"
            :to="`/links/${row.id}`"
            class="flex items-center justify-between gap-4 p-4 hover:bg-muted/50 sm:px-5"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ row.title || row.slug }}
              </p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <UBadge :label="row.utmSource ? `utm_source=${row.utmSource}` : 'no utm_source'" :color="row.utmSource ? 'neutral' : 'warning'" variant="subtle" size="sm" />
                <UBadge v-if="row.utmContent" :label="`utm_content=${row.utmContent}`" color="neutral" variant="subtle" size="sm" />
              </div>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-lg font-semibold tabular-nums text-highlighted">
                {{ row.periodClicks.toLocaleString() }}
              </p>
              <p class="text-xs text-muted">
                {{ row.totalClicks.toLocaleString() }} all time
              </p>
            </div>
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>
