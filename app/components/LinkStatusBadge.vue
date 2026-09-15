<script setup lang="ts">
import { deriveLinkStatus } from '#shared/link-status';

type LinkStatus = 'active' | 'disabled' | 'expired';

const props = defineProps<{
  status?: LinkStatus;
  link?: { isEnabled: boolean; expiresAt: string | Date | null };
  expiresAt?: Date | string | null;
}>();

const resolved = computed(() => {
  if (props.status)
    return props.status;
  if (props.link) {
    const exp = props.link.expiresAt ? new Date(props.link.expiresAt) : null;
    return deriveLinkStatus({ isEnabled: props.link.isEnabled, expiresAt: exp });
  }
  return 'active' as LinkStatus;
});

const meta = computed(() => {
  if (resolved.value === 'active')
    return { icon: 'i-lucide-check', label: 'Active', tip: 'Link is active' };
  if (resolved.value === 'disabled')
    return { icon: 'i-lucide-pause', label: 'Disabled', tip: 'Owner disabled this link' };
  return { icon: 'i-lucide-clock', label: 'Expired', tip: 'Link has expired' };
});

const expiryText = computed(() => {
  const d = props.expiresAt ?? props.link?.expiresAt;
  if (!d || resolved.value !== 'expired')
    return '';
  return new Date(d).toLocaleDateString();
});
</script>

<template>
  <UTooltip :text="meta.tip">
    <UBadge :color="resolved === 'active' ? 'success' : resolved === 'expired' ? 'warning' : 'neutral'" variant="subtle" size="sm" class="whitespace-nowrap">
      <UIcon :name="meta.icon" class="size-4" aria-hidden="true" />
      <span>{{ meta.label }}</span>
      <span v-if="expiryText" class="text-muted">· {{ expiryText }}</span>
    </UBadge>
  </UTooltip>
</template>
