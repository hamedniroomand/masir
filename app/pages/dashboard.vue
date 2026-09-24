<script setup lang="ts">
definePageMeta({ layout: 'default' });
useHead({ title: 'Overview · Masir' });

type Summary = { id: string; slug: string; title: string | null; clickCount: number; maximumVisits: number | null; expiresAt: string | null };
type Dashboard = {
  clicks: number;
  uniqueVisitors: number;
  botRequests: number;
  timeline: { bucket: string; count: number }[];
  topLinks: { id: string; slug: string; title: string | null; clicks: number }[];
  attention: { expiringSoon: Summary[]; nearCap: Summary[]; stopped: Summary[] };
  change?: { absolute: number; percent: number | null };
  meta?: {
    timezone: string;
    period?: string | null;
    from?: string;
    to?: string;
    traffic?: string;
    earliestEventAt?: string | null;
    signals?: string[];
    warning?: string;
  };
};

const { period, fromDate, toDate, compare, query: rangeQuery } = useAnalyticsRange('7d');
const createOpen = ref(false);
const { current, canManageLinks } = useCurrentWorkspace();

const { data, pending, error, refresh } = useApi<Dashboard>('/api/workspaces/analytics', {
  query: rangeQuery,
  watch: [rangeQuery],
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

const csvHref = computed(() => {
  const params = new URLSearchParams(rangeQuery.value);
  const query = params.toString();
  return query ? `/api/workspaces/analytics.csv?${query}` : '/api/workspaces/analytics.csv';
});

const attentionGroups = computed(() => [
  { key: 'expiringSoon', title: 'Expires within 7 days', icon: 'i-lucide-calendar-clock', items: data.value?.attention.expiringSoon ?? [] },
  { key: 'nearCap', title: 'Close to its visit cap', icon: 'i-lucide-gauge', items: data.value?.attention.nearCap ?? [] },
  { key: 'stopped', title: 'Stopped working', icon: 'i-lucide-circle-slash', items: data.value?.attention.stopped ?? [] },
]);

const needsAttention = computed(() => attentionGroups.value.some(group => group.items.length));
const isEmpty = computed(() => !!data.value && data.value.clicks === 0 && !data.value.topLinks.length && !needsAttention.value);

function noteFor(group: string, link: Summary) {
  if (group === 'nearCap')
    return `${link.clickCount} of ${link.maximumVisits} visits used`;
  if (link.expiresAt)
    return new Date(link.expiresAt).toLocaleDateString();
  return `${link.clickCount} of ${link.maximumVisits} visits used`;
}
</script>

<template>
  <div class="space-y-6">
    <div class="page-heading">
      <div>
        <h1 class="page-title">
          Overview
        </h1><p class="page-description">
          How this workspace is doing, and what needs attention.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
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

    <FirstUseChecklist
      v-if="canManageLinks && current"
      :workspace-id="current.id"
      @create-link="createOpen = true"
    />

    <div v-if="pending" class="space-y-4" role="status" aria-label="Loading the overview">
      <USkeleton v-for="n in 3" :key="n" class="h-24 w-full" /><span class="sr-only">Loading the overview</span>
    </div>

    <div v-else-if="error" class="surface p-5">
      <UAlert title="Could not load the overview" description="Try again to load this workspace's numbers." color="error" variant="soft" icon="i-lucide-circle-alert" /><UButton label="Try again" variant="outline" size="sm" class="mt-4" @click="refresh()" />
    </div>

    <template v-else-if="data">
      <div v-if="isEmpty" class="surface relative isolate overflow-hidden px-5 py-20 text-center">
        <BrandPattern variant="edges" />
        <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-xl border border-default bg-primary/5 shadow-control">
          <UIcon name="i-lucide-chart-no-axes-combined" class="size-6 text-primary" />
        </div>
        <h2 class="text-sm font-semibold text-highlighted">
          Nothing to show yet
        </h2>
        <p class="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted">
          Create a short link and this page fills with its traffic.
        </p>
        <UButton v-if="canManageLinks" class="mt-4" label="Create your first link" icon="i-lucide-plus" size="sm" @click="createOpen = true" />
      </div>

      <template v-else>
        <AnalyticsReportMeta :meta="data.meta" />
        <div class="surface metric-grid p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <MetricStat label="Clicks" :value="data.clicks.toLocaleString()" hint="Successful human redirects" />
            <AnalyticsChangeHint :change="data.change" />
          </div>
          <MetricStat label="Unique visitors" :value="data.uniqueVisitors.toLocaleString()" /><MetricStat label="Bot requests" :value="data.botRequests.toLocaleString()" /><MetricStat label="Needs attention" :value="String(data.attention.expiringSoon.length + data.attention.nearCap.length + data.attention.stopped.length)" hint="Links to look at" />
        </div>

        <div class="surface px-3 pb-3 pt-5 sm:px-5">
          <p class="mb-4 text-xs font-medium text-muted">
            Clicks over time
          </p>
          <LinkClicksChart :series="data.timeline" :hourly="hourly" />
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
          <section aria-label="Top links" class="surface">
            <h2 class="border-b border-default px-5 py-3.5 text-[13px] font-semibold text-highlighted">
              Top links
            </h2>
            <p v-if="!data.topLinks.length" class="px-5 py-8 text-center text-sm text-muted">
              No clicks in this period.
            </p>
            <ul v-else class="divide-y divide-default">
              <li v-for="link in data.topLinks" :key="link.id">
                <NuxtLink :to="`/links/${link.id}`" class="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/60">
                  <span class="min-w-0">
                    <span class="block truncate text-[13px] font-medium text-highlighted">{{ link.title || link.slug }}</span>
                    <span class="block truncate text-xs text-muted">/{{ link.slug }}</span>
                  </span>
                  <span class="shrink-0 text-sm font-medium tabular-nums text-highlighted">{{ link.clicks.toLocaleString() }}</span>
                </NuxtLink>
              </li>
            </ul>
          </section>

          <section aria-label="Needs attention" class="surface">
            <h2 class="border-b border-default px-5 py-3.5 text-[13px] font-semibold text-highlighted">
              Needs attention
            </h2>
            <p v-if="!needsAttention" class="px-5 py-8 text-center text-sm text-muted">
              No expiry or visit-cap alerts.
            </p>
            <template v-else>
              <div v-for="group in attentionGroups" :key="group.key">
                <template v-if="group.items.length">
                  <h3 class="flex items-center gap-1.5 bg-muted/30 px-5 py-2 text-xs font-medium text-muted">
                    <UIcon :name="group.icon" class="size-3.5" />{{ group.title }}
                  </h3>
                  <ul class="divide-y divide-default">
                    <li v-for="link in group.items" :key="link.id">
                      <NuxtLink :to="`/links/${link.id}`" class="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/60">
                        <span class="truncate text-[13px] text-highlighted">{{ link.title || link.slug }}</span>
                        <span class="shrink-0 text-xs text-muted">{{ noteFor(group.key, link) }}</span>
                      </NuxtLink>
                    </li>
                  </ul>
                </template>
              </div>
            </template>
          </section>
        </div>
      </template>
    </template>

    <USlideover
      v-if="canManageLinks"
      v-model:open="createOpen"
      title="Create a link"
      description="A short address for your next destination."
      :unmount-on-hide="false"
      :ui="{ content: 'sm:max-w-[480px]' }"
    >
      <template #body>
        <LinkCreateForm @created="refresh()" />
      </template>
    </USlideover>
  </div>
</template>
