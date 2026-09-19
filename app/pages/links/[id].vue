<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';
import { LINK_TABS, resolveLinkTab } from '#shared/link-tabs';

definePageMeta({ layout: 'default' });

const route = useRoute();
const id = computed(() => route.params.id as string);

const { canManageLinks } = useCurrentWorkspace();

const tab = computed({
  get: () => {
    const value = resolveLinkTab(route.query.tab as string, route.hash);
    return value === 'settings' && !canManageLinks.value ? 'overview' : value;
  },
  set: (value: string) => navigateTo({ query: { ...route.query, tab: value === 'overview' ? undefined : value }, hash: '' }),
});

// A panel mounts on its first visit and stays, so its api calls wait for the
// tab and its form state survives a switch.
const visited = reactive(new Set([tab.value]));
watch(tab, value => visited.add(value));

const tabIcons = { overview: 'i-lucide-chart-no-axes-combined', settings: 'i-lucide-sliders-horizontal', history: 'i-lucide-history' };
const tabItems = computed(() => LINK_TABS
  .filter(value => value !== 'settings' || canManageLinks.value)
  .map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1), icon: tabIcons[value] })));

const { data: link, error, refresh: refreshLink } = await useApi<LinkItem>(() => `/api/links/${id.value}`);

useHead({ title: () => `${link.value?.title || link.value?.slug || 'Link'} · Masir` });

const creatorName = computed(() => {
  const creator = link.value?.creator;
  if (!creator)
    return '';
  return [creator.firstName, creator.lastName].filter(Boolean).join(' ') || creator.email;
});

const { copy, copied } = useClipboard();
const qrOpen = ref(false);

onMounted(() => {
  if (route.hash === '#analytics')
    nextTick(() => document.getElementById('analytics')?.scrollIntoView({ block: 'start' }));
});
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
        <p class="mt-2 text-xs text-muted">
          Created {{ new Date(link.createdAt).toLocaleDateString() }}<template v-if="link.creator">
            by <a :href="`mailto:${link.creator.email}`" class="text-toned hover:text-primary hover:underline">{{ creatorName }}</a>
          </template>
        </p>
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
        <template v-if="!visited.has(item.value)" />

        <LinkAnalyticsPanel v-else-if="item.value === 'overview'" :link-id="link.id" />

        <div v-else-if="item.value === 'settings'" class="max-w-4xl space-y-5">
          <LinkDestinationForm :link="link" @updated="refreshLink()" />
          <LinkTrackingForm :link="link" @updated="refreshLink()" />
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
