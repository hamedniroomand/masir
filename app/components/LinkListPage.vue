<script setup lang="ts">
import type { CampaignItem } from '~/composables/useCampaigns';
import type { LinkListFilter } from '~/composables/useLinks';

type SavedView = { name: string; query: Record<string, string | string[]> };

const route = useRoute();
const config = useRuntimeConfig();
const shortDomain = computed(() => new URL(config.public.shortDomain).host);
useHead({ title: 'All links · Masir' });
const createOpen = ref(false);
const { canManageLinks, current } = useCurrentWorkspace();
const createFormRef = ref<{ isDirty: boolean; reset: () => void } | null>(null);
const createButtonRef = useTemplateRef('createButton');
const { $api } = useNuxtApp();
const showError = useErrorToast();
const toast = useToast();
const { options: campaignOptions, refresh: refreshCampaigns } = useCampaignOptions();

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

const {
  data,
  pending,
  refresh,
  error,
  page,
  sort,
  status,
  selectedTags,
  campaignId,
  createdBy,
  archived,
  trashed,
  needsReview,
  listFilter,
  tagList,
  toggleTag,
} = useLinksList();
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

const campaignFilterOptions = computed(() => [
  { label: 'All campaigns', value: 'all' },
  ...campaignOptions.value.filter(item => item.value != null).map(item => ({
    label: item.label,
    value: item.value as string,
  })),
]);

const creatorOptions = [
  { label: 'All creators', value: 'all' },
  { label: 'Me', value: 'me' },
];

const hasFilters = computed(() =>
  !!searchInput.value
  || status.value !== 'all'
  || selectedTags.value.length > 0
  || campaignId.value !== 'all'
  || createdBy.value !== 'all'
  || archived.value
  || trashed.value
  || needsReview.value,
);

function clearFilters() {
  searchInput.value = '';
  navigateTo({ query: { sort: route.query.sort } });
}

const useTagMenu = computed(() => (tagList.value?.items?.length ?? 0) > 15);
const tagMenuItems = computed(() => tagList.value?.items.map(tag => tag.name) ?? []);

// Selection: page ids, or the current list filter for "all matching".
const selectedIds = ref<Set<string>>(new Set());
const matchingAll = ref(false);

watch(() => data.value?.items, () => {
  if (!matchingAll.value)
    selectedIds.value = new Set();
}, { deep: true });

watch(listFilter, () => {
  matchingAll.value = false;
  selectedIds.value = new Set();
}, { deep: true });

const pageIds = computed(() => data.value?.items.map(item => item.id) ?? []);
const selectedCount = computed(() =>
  matchingAll.value ? (data.value?.total ?? 0) : selectedIds.value.size,
);
const allPageSelected = computed(() =>
  pageIds.value.length > 0 && pageIds.value.every(id => selectedIds.value.has(id)),
);
const selectionLabel = computed(() => {
  if (matchingAll.value)
    return `All ${selectedCount.value} matching`;
  return `${selectedCount.value} on this page`;
});

function toggleRow(id: string, on: boolean) {
  matchingAll.value = false;
  const next = new Set(selectedIds.value);
  if (on)
    next.add(id);
  else
    next.delete(id);
  selectedIds.value = next;
}

function togglePage(on: boolean) {
  matchingAll.value = false;
  selectedIds.value = on ? new Set(pageIds.value) : new Set();
}

function selectMatching() {
  matchingAll.value = true;
  selectedIds.value = new Set(pageIds.value);
}

function clearSelection() {
  matchingAll.value = false;
  selectedIds.value = new Set();
}

const bulkOpen = ref(false);
const bulkAction = ref<'tag' | 'untag' | 'assignCampaign' | 'archive'>('tag');
const bulkTagId = ref<string | undefined>();
const bulkCampaignId = ref<string | null>(null);
const bulkSaving = ref(false);
const campaignCreateOpen = ref(false);

async function onCampaignCreated(campaign: CampaignItem) {
  await refreshCampaigns();
  bulkCampaignId.value = campaign.id;
}

const tagOptions = computed(() =>
  (tagList.value?.items ?? []).map(tag => ({ label: tag.name, value: tag.id })),
);

function openBulk(action: 'tag' | 'untag' | 'assignCampaign' | 'archive') {
  bulkAction.value = action;
  bulkTagId.value = tagOptions.value[0]?.value;
  bulkCampaignId.value = null;
  bulkOpen.value = true;
}

async function runBulk() {
  if (!selectedCount.value)
    return;
  bulkSaving.value = true;
  try {
    const selection = matchingAll.value
      ? { filter: cleanFilter(listFilter.value) }
      : { ids: [...selectedIds.value] };
    const body: Record<string, unknown> = {
      selection,
      action: bulkAction.value,
    };
    if (bulkAction.value === 'tag' || bulkAction.value === 'untag')
      body.tagId = bulkTagId.value;
    if (bulkAction.value === 'assignCampaign')
      body.campaignId = bulkCampaignId.value;

    const result = await $api<{ affected: number }>('/api/links/bulk', {
      method: 'POST',
      body,
    });
    toast.add({
      title: `Updated ${result.affected} ${result.affected === 1 ? 'link' : 'links'}.`,
      icon: 'i-lucide-check',
    });
    if (bulkAction.value === 'assignCampaign')
      void refreshCampaignsList();
    bulkOpen.value = false;
    clearSelection();
    await refresh();
  }
  catch (err) {
    showError(err);
  }
  finally {
    bulkSaving.value = false;
  }
}

function cleanFilter(filter: LinkListFilter) {
  const out: Record<string, unknown> = {};
  if (filter.q)
    out.q = filter.q;
  if (filter.status)
    out.status = filter.status;
  if (filter.tags?.length)
    out.tags = filter.tags;
  if (filter.campaignId)
    out.campaignId = filter.campaignId;
  if (filter.createdBy)
    out.createdBy = filter.createdBy;
  if (filter.archived)
    out.archived = true;
  if (filter.trashed)
    out.trashed = true;
  if (filter.needsReview)
    out.needsReview = true;
  if (filter.sort && filter.sort !== 'createdAt')
    out.sort = filter.sort;
  return out;
}

const viewsKey = computed(() => current.value ? `masir:views:${current.value.id}` : null);
const savedViews = ref<SavedView[]>([]);

function loadViews() {
  if (!viewsKey.value || !import.meta.client) {
    savedViews.value = [];
    return;
  }
  try {
    const raw = localStorage.getItem(viewsKey.value);
    savedViews.value = raw ? JSON.parse(raw) as SavedView[] : [];
  }
  catch {
    savedViews.value = [];
  }
}

watch(viewsKey, loadViews, { immediate: true });

function persistViews() {
  if (!viewsKey.value || !import.meta.client)
    return;
  localStorage.setItem(viewsKey.value, JSON.stringify(savedViews.value));
}

function applyMyLinks() {
  navigateTo({ query: { createdBy: 'me', sort: route.query.sort } });
}

function applyArchived() {
  navigateTo({ query: { archived: 'true', sort: route.query.sort } });
}

function applyTrash() {
  navigateTo({ query: { trashed: 'true', sort: route.query.sort } });
}

function applyNeedsReview() {
  navigateTo({ query: { needsReview: 'true', sort: route.query.sort } });
}

function applyView(view: SavedView) {
  navigateTo({ query: { ...view.query } });
}

const saveViewOpen = ref(false);
const saveViewName = ref('');

function openSaveView() {
  saveViewName.value = '';
  saveViewOpen.value = true;
}

function saveCurrentView() {
  const name = saveViewName.value.trim();
  if (!name)
    return;
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(route.query)) {
    if (value == null || key === 'page')
      continue;
    if (Array.isArray(value))
      query[key] = value.filter((item): item is string => typeof item === 'string');
    else if (typeof value === 'string')
      query[key] = value;
  }
  savedViews.value = [...savedViews.value.filter(view => view.name !== name), { name, query }];
  persistViews();
  saveViewOpen.value = false;
}

function removeView(name: string) {
  savedViews.value = savedViews.value.filter(view => view.name !== name);
  persistViews();
}

const exportHref = computed(() => {
  const params = new URLSearchParams();
  if (searchInput.value)
    params.set('q', searchInput.value);
  if (status.value && status.value !== 'all')
    params.set('status', status.value);
  for (const tag of selectedTags.value)
    params.append('tags', tag);
  if (campaignId.value && campaignId.value !== 'all')
    params.set('campaignId', campaignId.value);
  if (createdBy.value && createdBy.value !== 'all')
    params.set('createdBy', createdBy.value);
  if (archived.value)
    params.set('archived', 'true');
  if (trashed.value)
    params.set('trashed', 'true');
  if (needsReview.value)
    params.set('needsReview', 'true');
  if (sort.value === 'clicks')
    params.set('sort', 'clicks');
  const query = params.toString();
  return query ? `/api/links/export.csv?${query}` : '/api/links/export.csv';
});

const bulkActionLabel = computed(() => {
  if (bulkAction.value === 'tag')
    return 'Add tag';
  if (bulkAction.value === 'untag')
    return 'Remove tag';
  if (bulkAction.value === 'archive')
    return 'Archive';
  return 'Assign campaign';
});
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
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <UButton
          v-if="canManageLinks"
          to="/links/import"
          label="Import"
          icon="i-lucide-upload"
          color="neutral"
          variant="outline"
        />
        <UButton
          :to="exportHref"
          label="Export"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          external
        />
        <UButton v-if="canManageLinks" ref="createButton" label="Create link" icon="i-lucide-plus" @click="createOpen = true" />
      </div>
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
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-5 py-3.5">
        <h2 class="flex items-center gap-2 text-[13px] font-semibold text-highlighted">
          <UIcon name="i-lucide-list-filter" class="size-4 text-muted" />Link library
        </h2>
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            label="My links"
            size="xs"
            :variant="createdBy === 'me' ? 'soft' : 'ghost'"
            :color="createdBy === 'me' ? 'primary' : 'neutral'"
            @click="applyMyLinks"
          />
          <UButton
            label="Needs review"
            size="xs"
            :variant="needsReview ? 'soft' : 'ghost'"
            :color="needsReview ? 'primary' : 'neutral'"
            @click="applyNeedsReview"
          />
          <UButton
            label="Archived"
            size="xs"
            :variant="archived ? 'soft' : 'ghost'"
            :color="archived ? 'primary' : 'neutral'"
            @click="applyArchived"
          />
          <UButton
            label="Trash"
            size="xs"
            :variant="trashed ? 'soft' : 'ghost'"
            :color="trashed ? 'primary' : 'neutral'"
            @click="applyTrash"
          />
          <UButton
            v-for="view in savedViews"
            :key="view.name"
            :label="view.name"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="applyView(view)"
            @contextmenu.prevent="removeView(view.name)"
          />
          <UButton
            v-if="hasFilters"
            label="Save view"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-bookmark"
            @click="openSaveView"
          />
          <UButton v-if="hasFilters" label="Reset filters" icon="i-lucide-x" color="neutral" variant="ghost" size="xs" @click="clearFilters" />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 border-b border-default bg-muted/30 p-3 sm:px-5">
        <UInput v-model="searchInput" icon="i-lucide-search" placeholder="Search links…" aria-label="Search links" size="sm" class="w-full sm:w-64" />
        <USelect v-model="status" :items="statusOptions" aria-label="Filter links by status" icon="i-lucide-filter" size="sm" class="w-full sm:w-44" />
        <USelect v-model="campaignId" :items="campaignFilterOptions" aria-label="Filter links by campaign" icon="i-lucide-megaphone" size="sm" class="w-full sm:w-44" />
        <USelect v-model="createdBy" :items="creatorOptions" aria-label="Filter links by creator" icon="i-lucide-user" size="sm" class="w-full sm:w-40" />
        <USelect v-model="sort" :items="[{ label: 'Newest first', value: 'createdAt' }, { label: 'Most clicked', value: 'clicks' }]" aria-label="Sort links" icon="i-lucide-arrow-down-wide-narrow" size="sm" class="w-full sm:ms-auto sm:w-44" />
      </div>
      <div v-if="tagList?.items?.length" class="flex flex-wrap gap-1.5 border-b border-default px-3 py-2.5 sm:px-5" aria-label="Filter links by tag">
        <USelectMenu
          v-if="useTagMenu"
          :model-value="selectedTags"
          multiple
          search-input
          :items="tagMenuItems"
          placeholder="Filter by tags"
          aria-label="Filter links by tag"
          size="sm"
          class="w-full sm:w-72"
          @update:model-value="selectedTags = $event"
        />
        <template v-else>
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
        </template>
      </div>

      <div
        v-if="canManageLinks && !trashed && selectedCount > 0"
        class="flex flex-wrap items-center gap-2 border-b border-default bg-primary/5 px-3 py-2.5 sm:px-5"
        role="region"
        aria-label="Bulk selection"
      >
        <p class="text-xs font-medium text-highlighted">
          {{ selectionLabel }}
        </p>
        <UButton
          v-if="!matchingAll && data && data.total > 0"
          :label="`Select all ${data.total} matching`"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="selectMatching"
        />
        <UButton label="Clear" size="xs" color="neutral" variant="ghost" @click="clearSelection" />
        <div class="ms-auto flex flex-wrap gap-1.5">
          <UButton label="Add tag" size="xs" variant="soft" @click="openBulk('tag')" />
          <UButton label="Remove tag" size="xs" color="neutral" variant="soft" @click="openBulk('untag')" />
          <UButton label="Assign campaign" size="xs" color="neutral" variant="soft" @click="openBulk('assignCampaign')" />
          <UButton label="Archive" size="xs" color="neutral" variant="soft" @click="openBulk('archive')" />
        </div>
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
          <span v-if="canManageLinks && !trashed" class="flex items-center">
            <UCheckbox
              :model-value="allPageSelected"
              aria-label="Select all links on this page"
              @update:model-value="togglePage($event === true)"
            />
          </span>
          <span v-else />
          <span>Link</span><span class="hidden xl:block">Destination</span><span>Status</span><span class="text-right">Clicks</span><span />
        </div>
        <LinkRow
          v-for="link in data.items"
          :key="link.id"
          :link="link"
          :selectable="canManageLinks && !trashed"
          :selected="matchingAll || selectedIds.has(link.id)"
          :in-trash="trashed"
          @update:selected="toggleRow(link.id, $event)"
          @refresh="refresh()"
        />
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

    <USlideover
      v-model:open="bulkOpen"
      :title="bulkActionLabel"
      :description="`${selectionLabel} in ${current?.name ?? 'this workspace'} (${shortDomain}).`"
      :ui="{ content: 'sm:max-w-[480px]' }"
    >
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-muted">
            This change applies in <strong>{{ current?.name }}</strong> on <strong>{{ shortDomain }}</strong>.
          </p>
          <USelect
            v-if="bulkAction === 'tag' || bulkAction === 'untag'"
            v-model="bulkTagId"
            :items="tagOptions"
            aria-label="Tag"
            placeholder="Choose a tag"
          />
          <USelect
            v-else-if="bulkAction === 'assignCampaign'"
            v-model="bulkCampaignId"
            :items="campaignOptions"
            aria-label="Campaign"
            placeholder="Choose a campaign"
          />
          <UButton
            v-if="bulkAction === 'assignCampaign'"
            label="Create campaign"
            icon="i-lucide-plus"
            size="xs"
            color="neutral"
            variant="link"
            class="px-0"
            @click="campaignCreateOpen = true"
          />
          <p v-else-if="bulkAction === 'archive'" class="text-sm text-muted">
            Archived links leave the default library. Public short links keep working.
          </p>
        </div>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="bulkOpen = false" />
        <UButton
          :label="bulkActionLabel"
          :loading="bulkSaving"
          :disabled="(bulkAction === 'tag' || bulkAction === 'untag') && !bulkTagId"
          @click="runBulk"
        />
      </template>
    </USlideover>

    <USlideover v-model:open="saveViewOpen" title="Save view" description="Store the current filters in this browser." :ui="{ content: 'sm:max-w-[480px]' }">
      <template #body>
        <UInput v-model="saveViewName" aria-label="View name" placeholder="View name" autofocus @keyup.enter="saveCurrentView" />
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="saveViewOpen = false" />
        <UButton label="Save view" :disabled="!saveViewName.trim()" @click="saveCurrentView" />
      </template>
    </USlideover>
    <CampaignCreateSlideover v-model:open="campaignCreateOpen" @created="onCampaignCreated" />
  </div>
</template>
