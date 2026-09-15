<script setup lang="ts">
defineProps<{
  linkId: string;
  shortUrl: string;
  label?: string;
}>();

const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <UModal
    v-model:open="open"
    title="QR code"
    :description="label ? `Scan or share offline for ${label}.` : 'Scan or share offline. It uses the same short link.'"
  >
    <template #body>
      <LinkQrPanel
        :link-id="linkId"
        :short-url="shortUrl"
        show-short-url
        :preview-size="200"
      />
    </template>
  </UModal>
</template>
