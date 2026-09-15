<script setup lang="ts">
definePageMeta({ layout: 'default' });

const route = useRoute();
useHead({ title: 'My links · Linkyard' });
const createOpen = ref(false);
const { data, pending, refresh, error, status, page, sort } = useLinksList();
const searchInput = ref((route.query.q as string) ?? '');
const debouncedQ = refDebounced(searchInput, 300);

watch(debouncedQ, (v) => {
  navigateTo({ query: { ...route.query, q: v || undefined, page: undefined } });
});
watch(() => route.query.q, (v) => {
  searchInput.value = (v as string) ?? '';
});

const filterOptions = [
  { label: 'All links', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Expired', value: 'expired' },
];
</script>

<template>
  <div class="space-y-7">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">
          My links
        </h1><p class="mt-2 text-sm text-muted">
          Create, share, and keep your links up to date.
        </p>
      </div>
      <UModal v-model:open="createOpen" title="Create a link" description="Give a long URL a short, memorable address.">
        <UButton label="Create link" icon="i-lucide-plus" size="lg" class="shrink-0" />
        <template #body>
          <LinkCreateForm @created="refresh()" />
        </template>
      </UModal>
    </div>
    <div class="flex flex-col justify-between gap-4 rounded-xl border border-primary/15 bg-primary/5 p-5 sm:flex-row sm:items-center">
      <div class="flex items-center gap-4">
        <div class="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-default text-primary sm:flex">
          <UIcon name="i-lucide-signpost" class="size-6" />
        </div><div>
          <h2 class="text-sm font-semibold text-highlighted">
            One address. Always the right destination.
          </h2><p class="mt-1 text-sm text-muted">
            Update a destination anytime. Your short link and QR code stay the same.
          </p>
        </div>
      </div>
    </div>
    <section aria-label="Link library" class="overflow-hidden rounded-xl border border-default bg-default">
      <div class="flex flex-col gap-4 border-b border-default p-4 sm:p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <h2 class="font-semibold text-highlighted">
              Link library
            </h2><UBadge v-if="data && !error" :label="String(data.total)" color="neutral" variant="subtle" size="sm" />
          </div>
          <UInput v-model="searchInput" icon="i-lucide-search" placeholder="Search by title, URL, or short link" aria-label="Search links" class="sm:max-w-80" />
        </div>
        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div class="flex flex-wrap gap-1" aria-label="Filter links by status">
            <UButton v-for="filter in filterOptions" :key="filter.value" :label="filter.label" :variant="status === filter.value ? 'soft' : 'ghost'" :color="status === filter.value ? 'primary' : 'neutral'" :aria-pressed="status === filter.value" size="sm" @click="status = filter.value" />
          </div>
          <USelect v-model="sort" :items="[{ label: 'Newest first', value: 'createdAt' }, { label: 'Most clicked', value: 'clicks' }]" aria-label="Sort links" icon="i-lucide-arrow-down-wide-narrow" class="w-full sm:w-44" />
        </div>
      </div>
      <div v-if="pending" class="space-y-6 p-6" role="status" aria-label="Loading links">
        <USkeleton v-for="n in 4" :key="n" class="h-14 w-full" /><span class="sr-only">Loading links</span>
      </div>
      <div v-else-if="error" class="p-6">
        <UAlert title="Could not load links" description="Try again to load your link library." color="error" variant="soft" icon="i-lucide-circle-alert" /><UButton label="Try again" variant="outline" class="mt-4" @click="refresh()" />
      </div>
      <div v-else-if="!data?.items?.length" class="px-5 py-16 text-center">
        <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-default bg-muted">
          <UIcon :name="searchInput || status !== 'all' ? 'i-lucide-search' : 'i-lucide-link'" class="size-6 text-primary" />
        </div>
        <h3 class="font-semibold text-highlighted">
          {{ searchInput || status !== 'all' ? 'No matching links' : 'Your next link starts here' }}
        </h3>
        <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
          {{ searchInput || status !== 'all' ? 'Try another search or status filter.' : 'Create a short link for a campaign, a document, or a resource you share often.' }}
        </p>
        <UButton v-if="!searchInput && status === 'all'" class="mt-5" label="Create your first link" icon="i-lucide-plus" @click="createOpen = true" />
      </div>
      <div v-else class="divide-y divide-default">
        <LinkRow v-for="link in data.items" :key="link.id" :link="link" @refresh="refresh()" />
      </div>
      <div v-if="data && !error && data.total > 0" class="flex flex-wrap items-center justify-between gap-3 border-t border-default px-5 py-4">
        <p class="text-xs text-muted">
          {{ data.total }} {{ data.total === 1 ? 'link' : 'links' }}{{ searchInput || status !== 'all' ? (data.total === 1 ? ' matches this view' : ' match this view') : ' in your library' }}
        </p>
        <UPagination v-if="data.total > data.perPage" v-model:page="page" :total="data.total" :items-per-page="data.perPage" :sibling-count="1" size="xs" />
      </div>
    </section>
    <p class="flex items-center justify-center gap-2 text-xs text-muted">
      <UIcon name="i-lucide-lock-keyhole" class="size-3.5" />Your link library is visible to your account.
    </p>
  </div>
</template>
