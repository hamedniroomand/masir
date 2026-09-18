<script setup lang="ts">
type HistoryEvent = {
  id: string;
  type: string;
  createdAt: string;
  actorName: string | null;
  fields: string[] | null;
};

const props = defineProps<{ linkId: string }>();

const { data, pending, error } = await useApi<{ items: HistoryEvent[] }>(() => `/api/links/${props.linkId}/history`);

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
  const changed = item.fields?.map(field => FIELD_LABELS[field] ?? field) ?? [];
  if (!changed.length)
    return 'Updated this link';
  return `Changed ${changed.join(', ')}`;
}
</script>

<template>
  <section class="surface">
    <div class="flex items-center justify-between border-b border-default bg-muted/40 px-5 py-3.5">
      <h3 class="text-[13px] font-semibold text-highlighted">
        Change history
      </h3>
      <span v-if="data?.items.length" class="text-xs text-muted">{{ data.items.length }} {{ data.items.length === 1 ? 'event' : 'events' }}</span>
    </div>
    <div v-if="pending" class="space-y-3 p-5" role="status" aria-label="Loading history">
      <USkeleton v-for="n in 3" :key="n" class="h-10 w-full" /><span class="sr-only">Loading history</span>
    </div>
    <div v-else-if="error" class="p-5">
      <UAlert title="Could not load history" description="Try again later." color="error" variant="soft" icon="i-lucide-circle-alert" />
    </div>
    <p v-else-if="!data?.items.length" class="px-5 py-16 text-center text-xs text-muted">
      No changes recorded for this link yet.
    </p>
    <ol v-else class="divide-y divide-default">
      <li v-for="item in data.items" :key="item.id" class="flex items-start gap-3.5 px-5 py-4">
        <div class="record-icon size-8" aria-hidden="true">
          <UIcon :name="ICONS[item.type] ?? 'i-lucide-activity'" class="size-3.5 text-muted" />
        </div>
        <div class="min-w-0">
          <p class="text-[13px] font-medium text-highlighted">
            {{ describe(item) }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ item.actorName ?? 'Unknown user' }}<span class="mx-1.5 text-dimmed">·</span>{{ new Date(item.createdAt).toLocaleString() }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>
