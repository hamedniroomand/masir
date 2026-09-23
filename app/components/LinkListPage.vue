<script setup lang="ts">
const route = useRoute();
const config = useRuntimeConfig();
const shortDomain = computed(() => new URL(config.public.shortDomain).host);
useHead({ title: 'All links · Masir' });
const createOpen = ref(false);
const { canManageLinks } = useCurrentWorkspace();
const createFormRef = ref<{ isDirty: boolean; reset: () => void } | null>(null);
const createButtonRef = useTemplateRef('createButton');

const { handleOpenUpdate } = useConfirmDiscard(
  () => createFormRef.value?.isDirty ?? false,
  createOpen,
);

watch(createOpen, (isOpen) => {
  if (!isOpen) {
    nextTick(() => {
      const el = (createButtonRef.value as { $el?: HTMLElement })?.$el ?? (createButtonRef.value as HTMLElement | null);
      el?.focus?.();
    });
  }
});

const { data, pending, refresh, error, status, page, sort, selectedTags, tagList, toggleTag } = useLinksList();
const searchInput = ref((route.query.q as string) ?? '');

watchDebounced(searchInput, (v) => {
  navigateTo({ query: { ...route.query, q: v || undefined, page: undefined } });
}, { debounce: 300 });
watch(() => route.query.q, (v) => {
  searchInput.value = (v as string) ?? '';
});

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Expired', value: 'expired' },
  { label: 'Limit reached', value: 'limit_reached' },
  { label: 'Scheduled', value: 'scheduled' },
];

const hasFilters = computed(() => !!searchInput.value || status.value !== 'all' || selectedTags.value.length > 0);

function clearFilters() {
  searchInput.value = '';
  navigateTo({ query: { sort: route.query.sort } });
}
</script>

<template>
  <div class="space-y-6">
    <div class="page-heading">
      <div>
        <h1 class="page-title">
          All links<UBadge v-if="data && !error" :label="String(data.total)" color="neutral" variant="subtle" size="sm" />
        </h1><p class="page-description">
          Create, share, and keep your links up to date.
        </p>
      </div>
      <UButton v-if="canManageLinks" ref="createButton" label="Create link" icon="i-lucide-plus" class="shrink-0" @click="createOpen = true" />
    </div>

    <USlideover
      v-if="canManageLinks"
      :open="createOpen"
      title="Create a link"
      description="A short address for your next destination."
      :unmount-on-hide="false"
      :ui="{ content: 'sm:max-w-[480px]' }"
      @update:open="handleOpenUpdate"
    >
      <template #body>
        <LinkCreateForm ref="createFormRef" @created="refresh()" />
      </template>
    </USlideover>

    <section aria-label="Link library" class="surface">
      <div class="flex items-center justify-between gap-3 border-b border-default px-5 py-3.5">
        <h2 class="flex items-center gap-2 text-[13px] font-semibold text-highlighted">
          <UIcon name="i-lucide-list-filter" class="size-4 text-muted" />Link library
        </h2>
        <UButton v-if="hasFilters" label="Reset filters" icon="i-lucide-x" color="neutral" variant="ghost" size="xs" @click="clearFilters" />
      </div>
      <div class="flex flex-wrap items-center gap-2 border-b border-default bg-muted/30 p-3 sm:px-5">
        <UInput v-model="searchInput" icon="i-lucide-search" placeholder="Search links…" aria-label="Search links" size="sm" class="w-full sm:w-64" />
        <USelect v-model="status" :items="statusOptions" aria-label="Filter links by status" icon="i-lucide-filter" size="sm" class="w-full sm:w-44" />
        <USelect v-model="sort" :items="[{ label: 'Newest first', value: 'createdAt' }, { label: 'Most clicked', value: 'clicks' }]" aria-label="Sort links" icon="i-lucide-arrow-down-wide-narrow" size="sm" class="w-full sm:ms-auto sm:w-44" />
      </div>
      <div v-if="tagList?.items?.length" class="flex flex-wrap gap-1.5 border-b border-default px-3 py-2.5 sm:px-5" aria-label="Filter links by tag">
        <UButton
          v-for="tag in tagList.items"
          :key="tag.name"
          :label="tag.name"
          size="xs"
          :variant="selectedTags.includes(tag.name) ? 'soft' : 'outline'"
          :color="selectedTags.includes(tag.name) ? 'primary' : 'neutral'"
          :aria-pressed="selectedTags.includes(tag.name)"
          @click="toggleTag(tag.name)"
        />
      </div>
      <div v-if="pending" class="space-y-4 p-4" role="status" aria-label="Loading links">
        <USkeleton v-for="n in 4" :key="n" class="h-12 w-full" /><span class="sr-only">Loading links</span>
      </div>
      <div v-else-if="error" class="p-5">
        <UAlert title="Could not load links" description="Try again to load your link library." color="error" variant="soft" icon="i-lucide-circle-alert" /><UButton label="Try again" variant="outline" size="sm" class="mt-4" @click="refresh()" />
      </div>
      <div v-else-if="!data?.items?.length" class="relative isolate overflow-hidden px-5 py-20 text-center">
        <BrandPattern v-if="!hasFilters" variant="edges" />
        <div v-if="!hasFilters" class="mx-auto mb-8 flex max-w-sm items-center justify-center gap-3" aria-hidden="true">
          <div class="flex size-11 shrink-0 items-center justify-center rounded-xl border border-default bg-muted/50 text-muted">
            <UIcon name="i-lucide-globe" class="size-5" />
          </div>
          <div class="h-px w-6 bg-accented" />
          <div class="min-w-0 rounded-lg border border-primary/20 bg-default px-4 py-3 text-left shadow-control">
            <div class="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <UIcon name="i-lucide-link-2" class="size-3.5 text-primary" />Your short link
            </div>
            <div class="truncate text-xs font-medium text-highlighted">
              {{ shortDomain }}<span class="text-primary">/your-link</span>
            </div>
          </div>
          <div class="h-px w-6 bg-accented" />
          <UIcon name="i-lucide-arrow-up-right" class="size-5 shrink-0 text-muted" />
        </div>
        <div v-else class="mx-auto mb-5 flex size-14 items-center justify-center rounded-xl border border-default bg-default shadow-control">
          <UIcon name="i-lucide-search" class="size-6 text-primary" />
        </div>
        <h2 class="text-sm font-semibold text-highlighted">
          {{ hasFilters ? 'No matching links' : 'Create your first short link' }}
        </h2>
        <p class="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted">
          {{ hasFilters ? 'Try another search, status, or tag.' : 'Create a short link for a campaign, a document, or a resource you share often.' }}
        </p>
        <UButton v-if="hasFilters" class="mt-4" label="Clear filters" icon="i-lucide-x" color="neutral" variant="outline" size="sm" @click="clearFilters" />
        <template v-else-if="canManageLinks">
          <UButton class="mt-4" label="Create your first link" icon="i-lucide-plus" size="sm" @click="createOpen = true" />
          <QuickCreateCard class="mx-auto mt-6 max-w-sm text-left" />
        </template>
      </div>
      <div v-else class="divide-y divide-default">
        <div class="link-grid column-heading hidden md:grid" aria-hidden="true">
          <span>Link</span><span class="hidden xl:block">Destination</span><span>Status</span><span class="text-right">Clicks</span><span />
        </div>
        <LinkRow v-for="link in data.items" :key="link.id" :link="link" @refresh="refresh()" />
      </div>
      <div v-if="data && !error && data.total > 0" class="flex flex-wrap items-center justify-between gap-3 border-t border-default bg-muted/30 px-5 py-3.5">
        <p class="text-xs text-muted">
          Showing {{ (page - 1) * data.perPage + 1 }}–{{ Math.min(page * data.perPage, data.total) }} of {{ data.total }} {{ data.total === 1 ? 'link' : 'links' }}
        </p>
        <UPagination v-if="data.total > data.perPage" v-model:page="page" :total="data.total" :items-per-page="data.perPage" :sibling-count="1" size="xs" />
      </div>
    </section>
    <div v-if="data && !error && !pending && !data.total && !hasFilters" class="grid gap-6 px-2 pt-4 sm:grid-cols-3">
      <div
        v-for="item in [
          { icon: 'i-lucide-arrow-left-right', title: 'One link, any destination', text: 'Update the destination without replacing the link you shared.' },
          { icon: 'i-lucide-chart-no-axes-combined', title: 'Know what gets a click', text: 'See traffic, referrers, and devices for each link.' },
          { icon: 'i-lucide-qr-code', title: 'Share beyond the screen', text: 'Download a QR code for print, packaging, and events.' },
        ]" :key="item.title"
      >
        <UIcon :name="item.icon" class="mb-3 size-4 text-muted" />
        <h3 class="text-xs font-semibold text-highlighted">
          {{ item.title }}
        </h3>
        <p class="mt-1.5 max-w-64 text-xs leading-5 text-muted">
          {{ item.text }}
        </p>
      </div>
    </div>
  </div>
</template>
