<script setup lang="ts">
interface HistoryEvent {
  id: string;
  type: string;
  createdAt: string;
  actorName: string | null;
  fields: string[] | null;
}

const props = defineProps<{ linkId: string }>();

const { data } = await useFetch<{ items: HistoryEvent[] }>(() => `/api/links/${props.linkId}/history`);

const FIELD_LABELS: Record<string, string> = {
  destinationUrl: 'destination',
  title: 'title',
  expiresAt: 'expiry date',
  isEnabled: 'availability',
};

const ICONS: Record<string, string> = {
  link_created: 'i-lucide-plus',
  link_updated: 'i-lucide-pencil',
  link_disabled_by_admin: 'i-lucide-shield-alert',
};

function describe(item: HistoryEvent) {
  if (item.type === 'link_created')
    return 'Created this link';
  if (item.type === 'link_disabled_by_admin')
    return 'Disabled this link';
  const changed = item.fields?.map(f => FIELD_LABELS[f] ?? f) ?? [];
  if (!changed.length)
    return 'Updated this link';
  return `Changed ${changed.join(', ')}`;
}
</script>

<template>
  <UCard v-if="data?.items.length">
    <template #header>
      <h2 class="font-semibold text-highlighted">
        History
      </h2><p class="mt-1 text-sm text-muted">
        Every change to this link, and who made it.
      </p>
    </template>
    <ol class="space-y-4">
      <li v-for="item in data.items" :key="item.id" class="flex gap-3">
        <div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-default bg-muted/60">
          <UIcon :name="ICONS[item.type] ?? 'i-lucide-activity'" class="size-3.5 text-muted" />
        </div>
        <div class="min-w-0">
          <p class="text-sm text-highlighted">
            {{ describe(item) }}
          </p>
          <p class="mt-0.5 text-xs text-muted">
            {{ item.actorName ?? 'Unknown user' }} · {{ new Date(item.createdAt).toLocaleString() }}
          </p>
        </div>
      </li>
    </ol>
  </UCard>
</template>
