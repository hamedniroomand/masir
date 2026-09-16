<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{ link: LinkItem }>();

const META = {
  active: { dot: 'bg-success', label: 'Active', tip: 'Link is active' },
  disabled: { dot: 'bg-neutral-400 dark:bg-neutral-500', label: 'Disabled', tip: 'Owner disabled this link' },
  expired: { dot: 'bg-warning', label: 'Expired', tip: 'Link has expired' },
  limit_reached: { dot: 'bg-warning', label: 'Limit reached', tip: 'Visit limit reached' },
  scheduled: { dot: 'bg-info', label: 'Scheduled', tip: 'Link is not active yet' },
} as const;

const meta = computed(() => META[props.link.status]);
const expiryText = computed(() => props.link.status === 'expired' && props.link.expiresAt
  ? new Date(props.link.expiresAt).toLocaleDateString()
  : '');
</script>

<template>
  <UTooltip :text="meta.tip">
    <span class="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md border border-default bg-default px-2 py-1 text-[11px] font-medium text-toned">
      <span class="size-1.5 shrink-0 rounded-full" :class="meta.dot" aria-hidden="true" />{{ meta.label }}<span v-if="expiryText" class="text-muted">· {{ expiryText }}</span>
    </span>
  </UTooltip>
</template>
