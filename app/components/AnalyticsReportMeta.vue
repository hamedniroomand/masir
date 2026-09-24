<script setup lang="ts">
type ReportMeta = {
  timezone?: string;
  period?: string | null;
  from?: string;
  to?: string;
  traffic?: string;
  attribution?: string;
  earliestEventAt?: string | null;
  legacyCount?: number;
  signals?: string[];
  warning?: string;
};

const props = defineProps<{ meta?: ReportMeta | null }>();

const line = computed(() => {
  const meta = props.meta;
  if (!meta)
    return '';
  const parts: string[] = [];
  parts.push(meta.timezone ?? 'UTC');
  if (meta.from && meta.to)
    parts.push(`${meta.from} → ${meta.to} (UTC, end exclusive)`);
  else if (meta.period)
    parts.push(`period ${meta.period}`);
  if (meta.traffic)
    parts.push(`traffic ${meta.traffic}`);
  if (meta.attribution)
    parts.push(`attribution ${meta.attribution}`);
  return parts.join(' · ');
});
</script>

<template>
  <div v-if="meta" class="space-y-1 text-xs text-muted">
    <p>{{ line }}</p>
    <UAlert
      v-if="meta.warning"
      :title="meta.warning"
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
      class="text-xs"
    />
    <p v-if="meta.signals?.includes('event_write_failed')" class="text-error">
      Event recording recently failed. Some clicks may be missing.
    </p>
  </div>
</template>
