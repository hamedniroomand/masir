<script setup lang="ts">
import type { AuditGroup } from '#shared/audit-groups';
import { AUDIT_GROUPS } from '#shared/audit-groups';

definePageMeta({ layout: 'default' });
useHead({ title: 'Activity log · Masir' });

type Row = {
  id: number;
  type: string;
  createdAt: string;
  detail: Record<string, unknown> | null;
  actorEmail: string | null;
  linkId: string | null;
  linkSlug: string | null;
};

// One sentence for each type the server writes. An unknown type falls back to
// the type with its underscores replaced, as the old page did.
const SENTENCE: Record<string, string> = {
  link_created: 'created link',
  link_updated: 'changed link',
  link_deleted: 'deleted link',
  link_slug_changed: 'renamed link',
  link_alias_added: 'added an address to link',
  link_alias_removed: 'removed an address from link',
  link_alert_sent: 'was warned about link',
  link_password_set: 'set a password on link',
  link_password_removed: 'removed the password from link',
  link_responsible_changed: 'changed who is responsible for link',
  link_archived: 'archived link',
  link_unarchived: 'restored link from archive',
  links_bulk_action: 'changed many links',
  slug_generation_exhausted: 'could not generate an address',
  campaign_created: 'created a campaign',
  campaign_updated: 'changed a campaign',
  campaign_deleted: 'deleted a campaign',
  invitation_sent: 'invited somebody',
  invitation_accepted: 'accepted an invitation',
  invitation_resent: 'resent an invitation',
  invitation_revoked: 'revoked an invitation',
  member_activity_changed: 'changed a member status',
  member_role_changed: 'changed a member role',
  member_removed: 'removed a member',
  ownership_transferred: 'transferred ownership',
  workspace_created: 'created the workspace',
  demo_created: 'opened the demo workspace',
  workspace_updated: 'changed the workspace',
  workspace_deleted: 'deleted the workspace',
  rate_limit_exceeded: 'hit a rate limit',
};

const GROUP_LABEL: Record<AuditGroup, string> = {
  links: 'Links',
  campaigns: 'Campaigns',
  members: 'Members',
  security: 'Security',
};

const group = ref<AuditGroup>('links');
const rows = ref<Row[]>([]);
const nextBefore = ref<number | null>(null);
const loadingMore = ref(false);

const tabItems = AUDIT_GROUPS.map(value => ({ value, label: GROUP_LABEL[value] }));

const { data, pending, error, refresh } = await useApi<{ items: Row[]; nextBefore: number | null }>('/api/admin/audit-events', {
  query: computed(() => ({ group: group.value })),
  watch: [group],
});

watch(data, (page) => {
  rows.value = page?.items ?? [];
  nextBefore.value = page?.nextBefore ?? null;
}, { immediate: true });

const { $api } = useNuxtApp();

async function loadMore() {
  if (!nextBefore.value)
    return;
  loadingMore.value = true;
  try {
    const page = await $api<{ items: Row[]; nextBefore: number | null }>('/api/admin/audit-events', {
      query: { group: group.value, before: nextBefore.value },
    });
    rows.value = [...rows.value, ...page.items];
    nextBefore.value = page.nextBefore;
  }
  finally {
    loadingMore.value = false;
  }
}

function sentence(row: Row) {
  return SENTENCE[row.type] ?? row.type.replaceAll('_', ' ');
}

function relativeTime(value: string) {
  const seconds = Math.round((Date.parse(value) - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 30], ['month', 12], ['year', Infinity]];
  let amount = seconds;
  for (const [unit, size] of units) {
    if (Math.abs(amount) < size)
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(amount), unit);
    amount /= size;
  }
  return value;
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="page-title">
        Activity log
      </h1><p class="page-description">
        What happened in this workspace. Sign-in events belong to an account, not a workspace, and are not listed here.
      </p>
    </div>

    <UTabs v-model="group" :items="tabItems" :ui="{ list: 'border-b border-default' }" />

    <div v-if="pending" class="space-y-3" role="status" aria-label="Loading the activity log">
      <USkeleton v-for="n in 4" :key="n" class="h-12 w-full" /><span class="sr-only">Loading the activity log</span>
    </div>

    <div v-else-if="error">
      <UAlert title="Could not load the activity log" description="Try again to load this workspace's activity." color="error" variant="soft" icon="i-lucide-circle-alert" /><UButton label="Try again" variant="outline" size="sm" class="mt-4" @click="refresh()" />
    </div>

    <p v-else-if="!rows.length" class="rounded-panel border border-default bg-default px-5 py-14 text-center text-sm text-muted">
      Nothing recorded in this group yet.
    </p>

    <template v-else>
      <ul aria-label="Activity" class="divide-y divide-default rounded-panel border border-default bg-default">
        <li v-for="row in rows" :key="row.id" class="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3.5 text-sm">
          <span class="font-medium text-highlighted">{{ row.actorEmail ?? 'System' }}</span>
          <span class="text-muted">{{ sentence(row) }}</span>
          <NuxtLink
            v-if="row.linkSlug && row.linkId"
            :to="`/links/${row.linkId}`"
            class="rounded-md bg-muted/60 px-1.5 py-0.5 text-xs text-primary hover:underline"
          >
            /{{ row.linkSlug }}
          </NuxtLink>
          <span class="ms-auto shrink-0 text-xs text-muted" :title="new Date(row.createdAt).toLocaleString()">{{ relativeTime(row.createdAt) }}</span>
        </li>
      </ul>
      <UButton
        v-if="nextBefore"
        label="Load more"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="loadingMore"
        @click="loadMore"
      />
    </template>
  </div>
</template>
