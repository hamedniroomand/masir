<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ refresh: [] }>();

const { copy, copied } = useClipboard();
const deleting = ref(false);
const modal = ref(false);

async function toggleEnabled() {
  await $fetch(`/api/links/${props.link.id}`, {
    method: 'PATCH',
    body: { isEnabled: !props.link.isEnabled },
  });
  emit('refresh');
}

async function remove() {
  deleting.value = true;
  try {
    await $fetch(`/api/links/${props.link.id}`, { method: 'DELETE' });
    modal.value = false;
    emit('refresh');
  }
  finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="border border-default rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="min-w-0 space-y-1">
      <p class="font-medium truncate">
        {{ link.title || link.slug }}
      </p>
      <p class="text-sm text-muted truncate">
        {{ link.shortUrl }}
      </p>
      <p class="text-xs text-muted">
        {{ link.destinationHost }} · {{ link.clickCount }} clicks
      </p>
      <LinkStatusBadge :status="link.status" :expires-at="link.expiresAt" />
    </div>
    <div class="flex flex-wrap gap-2">
      <UButton size="sm" :label="copied ? 'Copied' : 'Copy'" @click="copy(link.shortUrl)" />
      <UButton size="sm" label="Open" :href="link.shortUrl" target="_blank" />
      <UButton size="sm" label="Edit" :to="`/links/${link.id}`" />
      <UButton size="sm" label="Analytics" :to="`/links/${link.id}#analytics`" />
      <UButton size="sm" :label="link.isEnabled ? 'Disable' : 'Enable'" color="neutral" variant="outline" @click="toggleEnabled" />
      <UButton size="sm" label="Delete" color="error" variant="outline" @click="modal = true" />
    </div>
    <UModal v-model:open="modal" title="Delete link">
      <template #body>
        <p>Delete <strong>{{ link.slug }}</strong>? This cannot be undone.</p>
      </template>
      <template #footer>
        <UButton label="Cancel" variant="ghost" @click="modal = false" />
        <UButton label="Delete" color="error" :loading="deleting" @click="remove" />
      </template>
    </UModal>
  </div>
</template>
