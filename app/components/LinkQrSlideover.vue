<script setup lang="ts">
defineProps<{
  linkId: string;
  shortUrl: string;
  label?: string;
}>();

const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Share offline"
    :description="label ? `The same address as ${label}, on printed material.` : 'The same address, on printed material.'"
    :ui="{ content: 'sm:max-w-[480px]' }"
  >
    <template #body>
      <LinkQrPanel
        :link-id="linkId"
        :short-url="shortUrl"
        show-short-url
        :preview-size="200"
      />
    </template>
  </USlideover>
</template>
