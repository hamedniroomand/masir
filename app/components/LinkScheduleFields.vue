<script setup lang="ts">
const startsAt = defineModel<number | null>('startsAt', { default: null });
const expiresAt = defineModel<number | null>('expiresAt', { default: null });
</script>

<template>
  <div class="space-y-3">
    <UFormField label="Start time" name="startsAt" description="Optional. The link opens at this time.">
      <LinkExpiryPicker v-model="startsAt" empty-label="Not scheduled" />
    </UFormField>
    <UFormField label="Expiry date" name="expiresAt" description="Optional. The link stops working after this date.">
      <LinkExpiryPicker v-model="expiresAt" />
    </UFormField>
  </div>
</template>
