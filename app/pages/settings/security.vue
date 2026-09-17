<script setup lang="ts">
definePageMeta({ layout: 'default' });
useHead({ title: 'Security log · Linkyard' });

const type = ref('');
const { data, pending, error, refresh } = await useFetch('/api/admin/security-events', {
  query: computed(() => ({ type: type.value || undefined })),
  watch: [type],
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="page-title">
        Security log
      </h1><p class="page-description">
        What happened in this workspace. Sign-in events belong to an account, not a workspace, and are not listed here.
      </p>
    </div>
    <UInput v-model="type" placeholder="Filter by event type" aria-label="Filter security events by type" icon="i-lucide-search" size="sm" class="sm:max-w-64" />
    <div v-if="pending" class="space-y-3" role="status" aria-label="Loading security events">
      <USkeleton v-for="n in 4" :key="n" class="h-12 w-full" /><span class="sr-only">Loading security events</span>
    </div>
    <div v-else-if="error">
      <UAlert title="Could not load security events" description="Try again to load the security log." color="error" variant="soft" icon="i-lucide-circle-alert" /><UButton label="Try again" variant="outline" size="sm" class="mt-4" @click="refresh()" />
    </div>
    <p v-else-if="!data?.items.length" class="rounded-panel border border-default bg-default px-5 py-14 text-center text-sm text-muted">
      {{ type ? 'No events match this type.' : 'No security events recorded yet.' }}
    </p>
    <UTable
      v-else
      :data="data.items"
      :columns="[
        { accessorKey: 'type', header: 'Event' },
        { accessorKey: 'createdAt', header: 'Time' },
        { accessorKey: 'actorUserId', header: 'Actor' },
      ]"
    >
      <template #type-cell="{ row }">
        <span class="font-medium text-highlighted">{{ row.original.type.replaceAll('_', ' ') }}</span>
      </template>
      <template #createdAt-cell="{ row }">
        {{ new Date(row.original.createdAt).toLocaleString() }}
      </template>
      <template #actorUserId-cell="{ row }">
        <span class="text-muted">{{ row.original.actorUserId ?? 'System' }}</span>
      </template>
    </UTable>
  </div>
</template>
