<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import type { LinkItem } from '~/composables/useLinks';
import * as v from 'valibot';
import { LINK_TABS, resolveLinkTab } from '#shared/link-tabs';

definePageMeta({ layout: 'default' });

const route = useRoute();
const id = computed(() => route.params.id as string);
const period = ref<'24h' | '7d' | '30d' | 'all'>('7d');
const traffic = ref<'human' | 'bot' | 'all'>('human');

const tab = computed({
  get: () => resolveLinkTab(route.query.tab as string, route.hash),
  set: (value: string) => navigateTo({ query: { ...route.query, tab: value === 'overview' ? undefined : value }, hash: '' }),
});

const tabIcons = { overview: 'i-lucide-chart-no-axes-combined', settings: 'i-lucide-sliders-horizontal', history: 'i-lucide-history' };
const tabItems = LINK_TABS.map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1), icon: tabIcons[value] }));

const { data: link, error, refresh: refreshLink } = await useFetch<LinkItem>(() => `/api/links/${id.value}`);

const { data: analytics } = useFetch(() => `/api/links/${id.value}/analytics`, {
  query: computed(() => ({ period: period.value, traffic: traffic.value })),
  watch: [period, traffic],
});

useHead({ title: () => `${link.value?.title || link.value?.slug || 'Link'} · Linkyard` });

const { copy, copied } = useClipboard();
const qrOpen = ref(false);

const destSchema = v.object({
  destinationUrl: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a destination URL.')),
});

type DestSchema = v.InferOutput<typeof destSchema>;

const destState = reactive({ destinationUrl: '' });
const destForm = useTemplateRef('destForm');
const saving = ref(false);
const destSaved = ref(false);

const tracking = reactive({
  campaignId: null as string | null,
  utmSource: '',
  utmCampaign: '',
  utmTerm: '',
  utmContent: '',
});
const savingTracking = ref(false);
const trackingSaved = ref(false);
const showError = useErrorToast();

watch(link, (l) => {
  if (l) {
    destState.destinationUrl = l.destinationUrl;
    tracking.campaignId = l.campaignId;
    tracking.utmSource = l.utmSource ?? '';
    tracking.utmCampaign = l.utmCampaign ?? '';
    tracking.utmTerm = l.utmTerm ?? '';
    tracking.utmContent = l.utmContent ?? '';
    destForm.value?.clear();
  }
}, { immediate: true });

watch(() => destState.destinationUrl, () => {
  destSaved.value = false;
});
watch(tracking, () => {
  trackingSaved.value = false;
});

onMounted(() => {
  if (route.hash === '#analytics')
    nextTick(() => document.getElementById('analytics')?.scrollIntoView({ block: 'start' }));
});

async function saveTracking() {
  if (!link.value)
    return;
  savingTracking.value = true;
  trackingSaved.value = false;
  try {
    await $fetch(`/api/links/${link.value.id}`, {
      method: 'PATCH',
      body: {
        campaignId: tracking.campaignId,
        utmSource: tracking.utmSource || null,
        utmCampaign: tracking.utmCampaign || null,
        utmTerm: tracking.utmTerm || null,
        utmContent: tracking.utmContent || null,
      },
    });
    await refreshLink();
    trackingSaved.value = true;
  }
  catch (e: unknown) {
    showError(e);
  }
  finally {
    savingTracking.value = false;
  }
}

async function saveDestination(_event: FormSubmitEvent<DestSchema>) {
  if (!link.value)
    return;
  saving.value = true;
  destSaved.value = false;
  destForm.value?.clear();
  try {
    await $fetch(`/api/links/${link.value.id}`, {
      method: 'PATCH',
      body: { destinationUrl: destState.destinationUrl },
    });
    await refreshLink();
    destSaved.value = true;
  }
  catch (e: unknown) {
    const err = e as { statusCode?: number; statusMessage?: string };
    if (err.statusCode === 422) {
      destForm.value?.setErrors([{
        name: 'destinationUrl',
        message: err.statusMessage || 'Invalid URL.',
      }]);
    }
    else {
      showError(e);
    }
  }
  finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="error" class="space-y-4">
    <UAlert title="Link not found" description="This link may have been deleted or belongs to another account." icon="i-lucide-circle-alert" color="error" variant="soft" /><UButton to="/" label="Back to all links" variant="outline" />
  </div>
  <div v-else-if="link" class="space-y-5">
    <UButton to="/" label="All links" icon="i-lucide-arrow-left" color="neutral" variant="link" size="sm" class="p-0" />
    <div class="page-heading">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <h1 class="break-all text-2xl font-semibold tracking-tight text-highlighted">
            {{ link.title || link.slug }}
          </h1><LinkStatusBadge :link="link" /><UBadge v-if="link.isProtected" color="primary" variant="subtle" size="sm" icon="i-lucide-lock" label="Password protected" />
        </div>
        <a :href="link.shortUrl" target="_blank" rel="noopener noreferrer" class="mt-2 block break-all text-sm text-primary hover:underline">{{ link.shortUrl }}</a>
      </div>
      <div class="flex shrink-0 gap-2">
        <UButton :label="copied ? 'Copied' : 'Copy link'" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" color="neutral" variant="outline" size="sm" @click="copy(link.shortUrl)" /><UButton label="QR code" icon="i-lucide-qr-code" color="neutral" variant="outline" size="sm" @click="qrOpen = true" />
      </div>
    </div>

    <div class="flex items-center gap-3 rounded-lg border border-default bg-muted/40 px-4 py-3 text-xs">
      <UIcon name="i-lucide-corner-down-right" class="size-4 shrink-0 text-muted" />
      <span class="shrink-0 text-muted">Destination</span>
      <a :href="link.destinationUrl" target="_blank" rel="noopener noreferrer" class="truncate text-toned hover:text-primary" :title="link.destinationUrl">{{ link.destinationUrl }}</a>
      <UIcon name="i-lucide-external-link" class="ml-auto size-3.5 shrink-0 text-muted" />
    </div>

    <LinkQrSlideover v-model:open="qrOpen" :link-id="link.id" :short-url="link.shortUrl" :label="link.title || link.slug" />

    <UTabs
      v-model="tab"
      :items="tabItems"
      variant="link"
      :unmount-on-hide="false"
      :ui="{ root: 'gap-7', list: 'border-b border-default', trigger: 'px-4 pb-3' }"
    >
      <template #content="{ item }">
        <div v-if="item.value === 'overview'" id="analytics" class="scroll-mt-6 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold text-highlighted">
                Link activity
              </h2><p class="mt-0.5 text-xs text-muted">
                Understand how this link is used.
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <USelect
                v-model="traffic"
                :items="[{ label: 'Human traffic', value: 'human' }, { label: 'Bot traffic', value: 'bot' }, { label: 'All traffic', value: 'all' }]"
                aria-label="Chart traffic"
                size="sm"
                class="w-40"
              /><USelect v-model="period" :items="[{ label: 'Last 24 hours', value: '24h' }, { label: 'Last 7 days', value: '7d' }, { label: 'Last 30 days', value: '30d' }, { label: 'All time', value: 'all' }]" aria-label="Analytics period" size="sm" class="w-40" />
            </div>
          </div>
          <template v-if="analytics">
            <p v-if="analytics.periodCoversLegacy" class="text-xs text-muted">
              Unique visitor and bot analytics
              {{ analytics.classificationAvailableFrom
                ? `available from ${new Date(analytics.classificationAvailableFrom).toLocaleDateString()}`
                : 'are not available yet' }}. Older clicks stay in the totals.
            </p>
            <div class="metric-grid" :class="analytics.maximumVisits == null ? 'lg:grid-cols-3' : 'lg:grid-cols-4'">
              <div>
                <p class="text-xs text-muted">
                  Total clicks
                </p><p class="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-highlighted">
                  {{ analytics.totalClicks.toLocaleString() }}
                </p><p class="mt-1 text-xs text-muted">
                  Successful human redirects
                </p>
              </div>
              <div>
                <p class="text-xs text-muted">
                  Unique visitors
                </p><p class="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-highlighted">
                  {{ analytics.uniqueVisitors.toLocaleString() }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted">
                  Bot requests
                </p><p class="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-highlighted">
                  {{ analytics.botRequests.toLocaleString() }}
                </p>
              </div>
              <div v-if="analytics.maximumVisits != null">
                <p class="text-xs text-muted">
                  Remaining visits
                </p><p class="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-highlighted">
                  {{ analytics.successfulVisitCount }} / {{ analytics.maximumVisits }}
                </p><p class="mt-1 text-xs text-muted">
                  visits used
                </p>
              </div>
            </div>
            <div v-if="analytics.periodClicks === 0" class="surface bg-muted/20 py-16 text-center">
              <UIcon name="i-lucide-chart-no-axes-column-increasing" class="mb-3 size-7 text-muted" /><h3 class="text-sm font-medium">
                No clicks in this period
              </h3><p class="mt-2 text-sm text-muted">
                Share your short link or choose another period.
              </p>
            </div>
            <template v-else>
              <div class="surface px-3 pb-3 pt-5 sm:px-5">
                <p class="mb-4 text-xs font-medium text-muted">
                  Clicks over time
                </p>
                <LinkClicksChart :series="analytics.series" :hourly="period === '24h'" />
              </div>
              <UCollapsible>
                <UButton label="View as table" icon="i-lucide-table" color="neutral" variant="ghost" size="xs" />
                <template #content>
                  <UTable
                    :data="analytics.series"
                    :columns="[{ accessorKey: 'bucket', header: 'Time' }, { accessorKey: 'count', header: 'Clicks' }]"
                    class="mt-3"
                  />
                </template>
              </UCollapsible>
              <div class="grid gap-4 pt-2 sm:grid-cols-2">
                <BreakdownList title="Referrers" :items="analytics.topReferrers" /><BreakdownList title="Countries" :items="analytics.topCountries" /><BreakdownList title="Devices" :items="analytics.devices" /><BreakdownList title="Browsers" :items="analytics.browsers" />
              </div><p v-if="!analytics.topCountries.length" class="text-xs text-muted">
                Country data is unavailable for this deployment.
              </p>
            </template>
          </template>
        </div>

        <div v-else-if="item.value === 'settings'" class="max-w-4xl space-y-5">
          <UCard>
            <template #header>
              <h2 class="text-sm font-semibold text-highlighted">
                Destination
              </h2><p class="mt-0.5 text-xs text-muted">
                Update where this link goes. Its short address stays the same.
              </p>
            </template>
            <UForm
              ref="destForm"
              :schema="destSchema"
              :state="destState"
              :validate-on="[]"
              class="flex flex-col gap-3 sm:flex-row sm:items-start"
              @submit="saveDestination"
            >
              <UFormField name="destinationUrl" class="flex-1">
                <UInput
                  v-model="destState.destinationUrl"
                  type="text"
                  inputmode="url"
                  autocomplete="url"
                  aria-label="Destination URL"
                  icon="i-lucide-globe"
                />
              </UFormField>
              <UButton type="submit" label="Save changes" :loading="saving" />
            </UForm>
            <p v-if="destSaved" role="status" class="mt-3 flex items-center gap-1.5 text-xs text-success">
              <UIcon name="i-lucide-circle-check" class="size-3.5" />Destination saved
            </p>
          </UCard>
          <UCard>
            <template #header>
              <h2 class="text-sm font-semibold text-highlighted">
                Campaign and tracking
              </h2><p class="mt-0.5 text-xs text-muted">
                Linkyard adds these utm values to the destination on every click.
              </p>
            </template>
            <LinkUtmFields
              v-model:campaign-id="tracking.campaignId"
              v-model:utm-source="tracking.utmSource"
              v-model:utm-campaign="tracking.utmCampaign"
              v-model:utm-term="tracking.utmTerm"
              v-model:utm-content="tracking.utmContent"
              :destination-url="link.destinationUrl"
            />
            <template #footer>
              <div class="flex items-center gap-3">
                <UButton label="Save tracking" :loading="savingTracking" @click="saveTracking" />
                <p v-if="trackingSaved" role="status" class="flex items-center gap-1.5 text-xs text-success">
                  <UIcon name="i-lucide-circle-check" class="size-3.5" />Tracking saved
                </p>
              </div>
            </template>
          </UCard>
          <UCard>
            <template #header>
              <h2 class="text-sm font-semibold text-highlighted">
                Access
              </h2><p class="mt-0.5 text-xs text-muted">
                Schedule, visit limits, and expiration behavior.
              </p>
            </template>
            <LinkAccessSettings :link="link" @updated="refreshLink()" />
            <div class="mt-5 border-t border-default pt-5">
              <LinkAvailabilityControl :link="link" @updated="refreshLink()" />
            </div>
          </UCard>
        </div>

        <div v-else class="max-w-4xl">
          <LinkHistory :link-id="link.id" />
        </div>
      </template>
    </UTabs>
  </div>
</template>
