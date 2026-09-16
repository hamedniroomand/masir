<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const showError = useErrorToast();
const { pending, setLinkEnabled } = useLinkEnabledMutation();

async function onEnabledChange(isEnabled: boolean) {
  if (isEnabled === props.link.isEnabled)
    return;
  try {
    await setLinkEnabled(props.link.id, isEnabled);
    emit('updated');
  }
  catch (e) {
    showError(e);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="min-w-0">
      <p class="text-[13px] font-medium text-highlighted">
        {{ link.isEnabled ? 'Link is enabled' : 'Link is disabled' }}
      </p>
      <p class="mt-1 text-xs leading-5 text-muted">
        Disabled links show an unavailable page. The short URL and QR code stay the same.
      </p>
    </div>
    <USwitch
      :model-value="link.isEnabled"
      :loading="pending"
      :aria-label="link.isEnabled ? 'Disable link' : 'Enable link'"
      @update:model-value="onEnabledChange"
    />
  </div>
</template>
