<script setup lang="ts">
import type { CampaignItem } from '~/composables/useCampaigns';

const { $api } = useNuxtApp();

definePageMeta({ layout: 'default' });

const route = useRoute();
const id = computed(() => route.params.id as string);
const { period, fromDate, toDate, compare, query: rangeQuery } = useAnalyticsRange('7d');
const attribution = ref<'current' | 'recorded'>('current');
const editOpen = ref(false);
const batchOpen = ref(false);
const pickerOpen = ref(false);
const deleting = ref(false);
const deleteOpen = ref(false);
const showError = useErrorToast();
const { canManageLinks } = useCurrentWorkspace();

type LinkItemLite = { id: string; slug: string; title: string | null; shortUrl: string };
const attach = ref<LinkItemLite[]>([]);
const attachQuery = ref('');
const attaching = ref<string | null>(null);

const { data: campaign, error, refresh: refreshCampaign } = await useApi<CampaignItem>(() => `/api/campaigns/${id.value}`);

type CampaignAnalytics = {
  totalClicks: number;
  linkCount: number;
  periodClicks: number;
  series: { bucket: string; count: number }[];
  bySource: { label: string; count: number }[];
  byMedium?: { label: string; count: number }[];
  topReferrers: { label: string; count: number }[];
  topCountries: { label: string; count: number }[];
  devices: { label: string; count: number; percentage: number }[];
  topLinks: { id: string; slug: string; title: string | null; utmSource: string | null; utmContent: string | null; totalClicks: number; periodClicks: number }[];
  previous?: { clicks: number; uniqueVisitors: number; botRequests: number; bySource?: { label: string; count: number }[]; byMedium?: { label: string; count: number }[] };
  change?: { absolute: number; percent: number | null };
  meta: {
    attribution: string;
    legacyCount: number;
    timezone?: string;
    period?: string | null;
    from?: string;
    to?: string;
    traffic?: string;
    earliestEventAt?: string | null;
    signals?: string[];
    warning?: string;
  };
};

const { data: analytics, pending: analyticsPending, error: analyticsError, refresh: refreshAnalytics } = useApi<CampaignAnalytics>(() => `/api/campaigns/${id.value}/analytics`, {
  query: computed(() => ({ ...rangeQuery.value, attribution: attribution.value })),
  watch: [rangeQuery, attribution],
});

const hourly = computed(() => {
  if (period.value === '24h')
    return true;
  if (period.value !== 'custom' || !fromDate.value || !toDate.value)
    return false;
  const from = Date.parse(`${fromDate.value}T00:00:00.000Z`);
  const to = Date.parse(`${toDate.value}T00:00:00.000Z`);
  return to - from <= 24 * 3600_000;
});

useHead({ title: () => `${campaign.value?.name ?? 'Campaign'} · Masir` });

const topSource = computed(() => analytics.value?.bySource[0]);

async function onSaved() {
  editOpen.value = false;
  await Promise.all([refreshCampaign(), refreshAnalytics()]);
}

async function removeCampaign() {
  deleting.value = true;
  try {
    await $api(`/api/campaigns/${id.value}`, { method: 'DELETE' });
    await navigateTo('/campaigns');
  }
  catch (error: unknown) {
    showError(error);
  }
  finally {
    deleting.value = false;
  }
}

async function searchAttach() {
  const query = attachQuery.value.trim();
  const res = await $api<{ items: LinkItemLite[] }>('/api/links', { query: { q: query, perPage: 10 } });
  attach.value = res.items;
}

async function attachLink(linkId: string) {
  attaching.value = linkId;
  try {
    await $api(`/api/links/${linkId}`, { method: 'PATCH', body: { campaignId: id.value } });
    await Promise.all([refreshCampaign(), refreshAnalytics(), searchAttach()]);
  }
  catch (error: unknown) {
    showError(error);
  }
  finally {
    attaching.value = null;
  }
}

async function onBatchCreated() {
  await Promise.all([refreshCampaign(), refreshAnalytics()]);
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
        <UButton v-if="canManageLinks" label="Create links in this campaign" icon="i-lucide-plus" color="neutral" size="sm" @click="batchOpen = true" />
        <UButton v-if="canManageLinks" label="Add existing links" icon="i-lucide-link" color="neutral" variant="outline" size="sm" @click="pickerOpen = true; searchAttach()" />
        <UButton v-if="canManageLinks" label="Edit" icon="i-lucide-pencil" color="neutral" variant="outline" size="sm" @click="editOpen = true" />
        <UButton v-if="canManageLinks" label="Delete" icon="i-lucide-trash-2" color="error" variant="outline" size="sm" @click="deleteOpen = true" />
      </div>
    </div>

    <USlideover v-model:open="batchOpen" title="Create links" description="Several channel links from one destination." :ui="{ content: 'sm:max-w-[520px]' }">
      <template #body>
        <CampaignBatchForm
          :campaign-id="campaign.id"
          :campaign-utm-campaign="campaign.utmCampaign"
          :campaign-utm-medium="campaign.utmMedium"
          @created="onBatchCreated"
        />
      </template>
    </USlideover>

    <UModal v-model:open="pickerOpen" title="Add existing links" description="Attach workspace links to this campaign.">
      <template #body>
        <UInput v-model="attachQuery" placeholder="Search links" class="w-full mb-3" @keyup.enter="searchAttach()" />
        <UButton label="Search" size="xs" variant="outline" class="mb-3" @click="searchAttach()" />
        <div v-if="!attach.length" class="py-6 text-center text-sm text-muted">
          No links found.
        </div>
        <div v-else class="divide-y divide-default max-h-72 overflow-y-auto">
          <div v-for="link in attach" :key="link.id" class="flex items-center justify-between gap-3 py-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">
                {{ link.title || link.slug }}
              </p>
              <p class="truncate text-xs text-muted">
                {{ link.shortUrl }}
              </p>
            </div>
            <UButton label="Attach" size="xs" :loading="attaching === link.id" @click="attachLink(link.id)" />
          </div>
        </div>
      </template>
    </UModal>

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

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-highlighted">
          Campaign activity
        </h2>
        <p class="mt-0.5 text-xs text-muted">
          Clicks on every link in this campaign.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-model="attribution"
          :items="[{ label: 'Current membership', value: 'current' }, { label: 'Recorded at click', value: 'recorded' }]"
          aria-label="Attribution mode"
          class="w-48"
        />
        <AnalyticsRangeControls
          v-model:period="period"
          v-model:from-date="fromDate"
          v-model:to-date="toDate"
          v-model:compare="compare"
        />
        <UButton
          :to="csvHref"
          label="Download CSV"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          size="sm"
          external
        />
      </div>
    </div>

    <div v-if="analyticsPending" class="space-y-4" role="status" aria-label="Loading campaign activity">
      <div class="metric-grid">
        <USkeleton v-for="n in 4" :key="n" class="h-24 w-full" />
      </div>
      <USkeleton class="h-64 w-full" />
      <span class="sr-only">Loading campaign activity</span>
    </div>

    <div v-else-if="analyticsError" class="surface p-5">
      <UAlert
        title="Could not load campaign activity"
        description="Try again to load this campaign's numbers."
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
      />
      <UButton label="Try again" variant="outline" size="sm" class="mt-4" @click="refreshAnalytics()" />
    </div>

    <template v-else-if="analytics">
      <AnalyticsReportMeta :meta="analytics.meta" />
      <div class="metric-grid">
        <div class="p-5">
          <MetricStat size="md" label="Clicks in this period" :value="analytics.periodClicks.toLocaleString()" />
          <AnalyticsChangeHint :change="analytics.change" />
        </div>
        <MetricStat size="md" class="border-l border-default p-5" label="All-time clicks" :value="analytics.totalClicks.toLocaleString()" />
        <MetricStat size="md" class="border-t border-default p-5 lg:border-l lg:border-t-0" label="Links" :value="String(analytics.linkCount)" />
        <MetricStat size="md" class="border-l border-t border-default p-5 lg:border-t-0" label="Top source">
          <span class="block truncate" :title="topSource?.label">{{ topSource?.label ?? '—' }}</span>
        </MetricStat>
      </div>

      <section class="space-y-5 rounded-panel border border-default bg-default p-4 sm:p-5">
        <div v-if="analytics.periodClicks === 0" class="py-9 text-center">
          <UIcon name="i-lucide-chart-no-axes-column-increasing" class="mb-3 size-7 text-muted" />
          <h3 class="text-sm font-medium">
            No clicks in this period
          </h3>
          <p class="mt-2 text-sm text-muted">
            Share a link from this campaign or choose another period.
          </p>
          <p v-if="analytics.meta.legacyCount > 0" class="mt-3 text-xs text-muted">
            {{ analytics.meta.legacyCount === 1 ? '1 click was' : `${analytics.meta.legacyCount} clicks were` }} recorded before attribution existed. They appear only under current membership.
          </p>
        </div>
        <template v-else>
          <LinkClicksChart :series="analytics.series" :hourly="hourly" />
          <div class="grid gap-4 sm:grid-cols-2">
            <BreakdownList title="Sources" :items="analytics.bySource" />
            <BreakdownList
              v-if="analytics.previous?.bySource?.length && attribution === 'recorded'"
              title="Sources (previous)"
              :items="analytics.previous.bySource"
            />
            <BreakdownList v-if="analytics.byMedium?.length" title="Mediums" :items="analytics.byMedium" />
            <BreakdownList
              v-if="analytics.previous?.byMedium?.length && attribution === 'recorded'"
              title="Mediums (previous)"
              :items="analytics.previous.byMedium"
            />
            <BreakdownList title="Referrers" :items="analytics.topReferrers" />
            <BreakdownList title="Countries" :items="analytics.topCountries" />
            <BreakdownList title="Devices" :items="analytics.devices" />
          </div>
          <p v-if="analytics.meta.legacyCount > 0" class="text-xs text-muted">
            {{ analytics.meta.legacyCount === 1 ? '1 click was' : `${analytics.meta.legacyCount} clicks were` }} recorded before attribution existed. They appear only under current membership.
          </p>
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
        <div v-if="!analytics.topLinks.length" class="px-5 py-12 text-center">
          <p class="text-sm text-muted">
            No links use this campaign yet.
          </p>
          <UButton
            v-if="canManageLinks"
            class="mt-4"
            label="Create links in this campaign"
            icon="i-lucide-plus"
            @click="batchOpen = true"
          />
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
