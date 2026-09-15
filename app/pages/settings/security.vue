<script setup lang="ts">
definePageMeta({ layout: 'default' });

const type = ref('');
const { data } = await useFetch('/api/admin/security-events', {
  query: computed(() => ({ type: type.value || undefined })),
  watch: [type],
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">
        Security log
      </h1><p class="mt-2 text-sm text-muted">
        Review account and link security events in your workspace.
      </p>
    </div>
    <UInput v-model="type" placeholder="Filter by event type" aria-label="Filter security events by type" icon="i-lucide-search" class="max-w-sm" />
    <UTable
      v-if="data?.items"
      :data="data.items"
      :columns="[
        { accessorKey: 'type', header: 'Type' },
        { accessorKey: 'createdAt', header: 'Time' },
        { accessorKey: 'actorUserId', header: 'Actor' },
      ]"
    />
  </div>
</template>
