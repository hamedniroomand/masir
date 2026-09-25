<script setup lang="ts">
import type { CampaignItem } from '~/composables/useCampaigns';

const emit = defineEmits<{ created: [campaign: CampaignItem] }>();
const open = defineModel<boolean>('open', { required: true });
function onCreated(campaign: CampaignItem) {
  open.value = false;
  emit('created', campaign);
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Create a campaign"
    description="Set the utm values every link in this campaign shares."
    :ui="{ content: 'sm:max-w-[480px]' }"
  >
    <template #body>
      <CampaignForm @saved="onCreated" />
    </template>
  </USlideover>
</template>
