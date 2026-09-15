<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{ link: LinkItem }>();

const META = {
  active: { color: 'success', icon: 'i-lucide-check', label: 'Active', tip: 'Link is active' },
  disabled: { color: 'neutral', icon: 'i-lucide-pause', label: 'Disabled', tip: 'Owner disabled this link' },
  expired: { color: 'warning', icon: 'i-lucide-clock', label: 'Expired', tip: 'Link has expired' },
} as const;

const meta = computed(() => META[props.link.status]);
const expiryText = computed(() => props.link.status === 'expired' && props.link.expiresAt
  ? new Date(props.link.expiresAt).toLocaleDateString()
  : '');
</script>

<template>
  <UTooltip :text="meta.tip">
    <UBadge :color="meta.color" variant="subtle" size="sm" class="whitespace-nowrap">
      <UIcon :name="meta.icon" class="size-4" aria-hidden="true" />
      <span>{{ meta.label }}</span>
      <span v-if="expiryText" class="text-muted">· {{ expiryText }}</span>
    </UBadge>
  </UTooltip>
</template>
