<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{
  link: LinkItem;
  selected?: boolean;
  selectable?: boolean;
}>();

const emit = defineEmits<{ refresh: []; 'update:selected': [value: boolean] }>();

const { $api } = useNuxtApp();

const { canManageLinks } = useCurrentWorkspace();
const { copy, copied } = useClipboard();
const showError = useErrorToast();
const { saving: togglingEnabled, patch } = useLinkPatch(() => props.link.id);
const deleting = ref(false);
const modal = ref(false);
const qrOpen = ref(false);

const name = computed(() => props.link.title || props.link.slug);

const menuItems = computed(() => {
  const read = [
    { label: 'View analytics', icon: 'i-lucide-chart-no-axes-column-increasing', to: `/links/${props.link.id}#analytics` },
    { label: 'QR code', icon: 'i-lucide-qr-code', onSelect: () => { qrOpen.value = true; } },
    { label: 'Open link', icon: 'i-lucide-external-link', to: props.link.shortUrl, target: '_blank' },
  ];
  if (!canManageLinks.value)
    return [read];
  return [
    [{ label: 'Edit link', icon: 'i-lucide-pencil', to: `/links/${props.link.id}?tab=settings` }, ...read],
    [
      { label: props.link.isEnabled ? 'Disable link' : 'Enable link', icon: props.link.isEnabled ? 'i-lucide-pause' : 'i-lucide-play', disabled: togglingEnabled.value, onSelect: toggleEnabled },
      { label: 'Delete link', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { modal.value = true; } },
    ],
  ];
});

async function toggleEnabled() {
  try {
    await patch({ isEnabled: !props.link.isEnabled });
    emit('refresh');
  }
  catch (error) {
    showError(error);
  }
}

async function remove() {
  deleting.value = true;
  try {
    await $api(`/api/links/${props.link.id}`, { method: 'DELETE' });
    modal.value = false;
    emit('refresh');
  }
  catch (error) {
    showError(error);
  }
  finally {
    deleting.value = false;
  }
}
</script>

<template>
  <article class="link-grid group px-5 py-4 transition-colors hover:bg-muted/60">
    <div v-if="selectable" class="flex items-center">
      <UCheckbox
        :model-value="selected"
        :aria-label="`Select ${name}`"
        @update:model-value="emit('update:selected', $event === true)"
      />
    </div>
    <div v-else />
    <div class="flex min-w-0 items-center gap-3.5">
      <div class="record-icon" aria-hidden="true">
        {{ link.destinationHost.replace(/^www\./, '').charAt(0).toUpperCase() }}
      </div>
      <div class="min-w-0">
        <NuxtLink :to="`/links/${link.id}`" class="block truncate text-[13px] font-semibold text-highlighted hover:text-primary">
          {{ name }}
        </NuxtLink>
        <div class="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
          <UIcon v-if="link.isProtected" name="i-lucide-lock-keyhole" class="size-3 shrink-0 text-muted" />
          <a :href="link.shortUrl" target="_blank" rel="noopener noreferrer" class="truncate text-primary hover:underline">{{ link.shortUrl.replace(/^https?:\/\//, '') }}</a>
        </div>
        <div v-if="link.tags.length" class="mt-2 flex flex-wrap gap-1">
          <UBadge v-for="tag in link.tags" :key="tag" :label="tag" color="neutral" variant="soft" size="sm" />
        </div>
      </div>
    </div>
    <span class="hidden truncate text-xs text-muted xl:block" :title="link.destinationUrl">{{ link.destinationHost }}</span>
    <div class="flex items-center justify-between gap-3 ps-13.5 md:contents">
      <LinkStatusBadge :link="link" />
      <NuxtLink :to="`/links/${link.id}#analytics`" class="flex items-center justify-end gap-1.5 text-xs tabular-nums text-muted hover:text-primary" :aria-label="`${link.clickCount} clicks. View analytics for ${name}`">
        <UIcon name="i-lucide-chart-no-axes-column-increasing" class="size-3.5" />
        <span class="font-medium text-highlighted">{{ link.clickCount.toLocaleString() }}</span><span class="md:hidden">clicks</span>
      </NuxtLink>
      <div class="flex items-center justify-end gap-0.5">
        <UTooltip :text="copied ? 'Copied' : 'Copy link'">
          <UButton size="sm" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" :aria-label="copied ? 'Copied' : `Copy ${name}`" color="neutral" variant="ghost" @click="copy(link.shortUrl)" />
        </UTooltip>
        <UDropdownMenu :items="menuItems">
          <UButton icon="i-lucide-ellipsis" :aria-label="`Actions for ${name}`" size="sm" color="neutral" variant="ghost" />
        </UDropdownMenu>
      </div>
    </div>
    <LinkQrSlideover
      v-model:open="qrOpen"
      :link-id="link.id"
      :short-url="link.shortUrl"
      :label="name"
    />
    <UModal v-if="canManageLinks" v-model:open="modal" title="Delete link" description="This action cannot be undone.">
      <template #body>
        <p class="text-sm">
          Delete <strong>{{ name }}</strong>? Anyone with this short link or QR code will no longer reach the destination.
        </p>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="modal = false" /><UButton label="Delete link" color="error" :loading="deleting" @click="remove" />
      </template>
    </UModal>
  </article>
</template>
