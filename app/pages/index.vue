<script setup lang="ts">
definePageMeta({ layout: 'default' });

const route = useRoute();
const { data, pending, refresh, status } = useLinksList();
const searchInput = ref((route.query.q as string) ?? '');
const debouncedQ = refDebounced(searchInput, 300);

watch(debouncedQ, (v) => {
  navigateTo({ query: { ...route.query, q: v || undefined, page: undefined } });
});
watch(() => route.query.q, (v) => {
  searchInput.value = (v as string) ?? '';
});

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Expired', value: 'expired' },
];
</script>

<template>
  <div>
    <LinkCreateForm @created="refresh()" />
    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <UInput v-model="searchInput" placeholder="Search links" class="flex-1" />
      <USelect v-model="status" :items="filterOptions" value-key="value" label-key="label" class="w-full sm:w-48" />
    </div>
    <div v-if="pending" class="text-muted">
      Loading…
    </div>
    <div v-else-if="!data?.items?.length" class="text-muted py-8 text-center">
      <p v-if="searchInput || status !== 'all'">
        No links match this filter.
      </p>
      <p v-else>
        No links yet. Create your first short link above.
      </p>
    </div>
    <div v-else class="space-y-3">
      <LinkRow v-for="link in data.items" :key="link.id" :link="link" @refresh="refresh()" />
    </div>
  </div>
</template>
