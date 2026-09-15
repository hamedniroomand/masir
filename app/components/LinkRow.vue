<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ refresh: [] }>();

const { copy, copied } = useClipboard();
const showError = useErrorToast();
const { pending: togglingEnabled, setLinkEnabled } = useLinkEnabledMutation();
const deleting = ref(false);
const modal = ref(false);
const qrOpen = ref(false);

async function toggleEnabled() {
  try {
    await setLinkEnabled(props.link.id, !props.link.isEnabled);
    emit('refresh');
  }
  catch (e) {
    showError(e);
  }
}

async function remove() {
  deleting.value = true;
  try {
    await $fetch(`/api/links/${props.link.id}`, { method: 'DELETE' });
    modal.value = false;
    emit('refresh');
  }
  catch (e) {
    showError(e);
  }
  finally {
    deleting.value = false;
  }
}
</script>

<template>
  <article class="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center">
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <div class="flex size-11 shrink-0 items-center justify-center rounded-xl border border-default bg-muted/70">
        <UIcon name="i-lucide-link" class="size-5 text-muted" />
      </div>
      <div class="min-w-0">
        <NuxtLink :to="`/links/${link.id}`" class="block truncate text-sm font-semibold text-highlighted hover:text-primary">
          {{ link.title || link.slug }}
        </NuxtLink>
        <div class="mt-1 flex min-w-0 items-center gap-2 text-xs">
          <a :href="link.shortUrl" target="_blank" rel="noopener noreferrer" class="truncate text-primary hover:underline">{{ link.shortUrl }}</a><UIcon name="i-lucide-arrow-right" class="hidden size-3 shrink-0 text-dimmed md:block" /><span class="hidden truncate text-muted md:block">{{ link.destinationHost }}</span>
        </div>
      </div>
    </div>
    <div class="flex shrink-0 items-center justify-between gap-4 pl-15 sm:pl-0">
      <NuxtLink :to="`/links/${link.id}#analytics`" class="flex items-center gap-1.5 text-xs text-muted hover:text-primary" :aria-label="`${link.clickCount} clicks. View analytics for ${link.title || link.slug}`">
        <UIcon name="i-lucide-chart-no-axes-column-increasing" class="size-4" /><span class="font-medium tabular-nums text-highlighted">{{ link.clickCount.toLocaleString() }}</span><span class="hidden xl:inline">clicks</span>
      </NuxtLink>
      <LinkStatusBadge :link="link" />
      <div class="flex items-center gap-1">
        <UTooltip :text="copied ? 'Copied' : 'Copy link'">
          <UButton size="sm" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" :aria-label="copied ? 'Copied' : `Copy ${link.title || link.slug}`" color="neutral" variant="ghost" @click="copy(link.shortUrl)" />
        </UTooltip>
        <UTooltip text="QR code">
          <UButton
            size="sm"
            icon="i-lucide-qr-code"
            :aria-label="`QR code for ${link.title || link.slug}`"
            color="neutral"
            variant="ghost"
            @click="qrOpen = true"
          />
        </UTooltip>
        <UDropdownMenu
          :items="[
            [{ label: 'Edit link', icon: 'i-lucide-pencil', to: `/links/${link.id}` }, { label: 'View analytics', icon: 'i-lucide-chart-no-axes-column-increasing', to: `/links/${link.id}#analytics` }, { label: 'QR code', icon: 'i-lucide-qr-code', onSelect: () => { qrOpen = true; } }, { label: 'Open link', icon: 'i-lucide-external-link', to: link.shortUrl, target: '_blank' }],
            [{ label: link.isEnabled ? 'Disable link' : 'Enable link', icon: link.isEnabled ? 'i-lucide-pause' : 'i-lucide-play', disabled: togglingEnabled, onSelect: toggleEnabled }, { label: 'Delete link', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => { modal = true; } }],
          ]"
        >
          <UButton icon="i-lucide-ellipsis" :aria-label="`Actions for ${link.title || link.slug}`" size="sm" color="neutral" variant="ghost" />
        </UDropdownMenu>
      </div>
    </div>
    <LinkQrModal
      v-model:open="qrOpen"
      :link-id="link.id"
      :short-url="link.shortUrl"
      :label="link.title || link.slug"
    />
    <UModal v-model:open="modal" title="Delete link" description="This action cannot be undone.">
      <template #body>
        <p>Delete <strong>{{ link.slug }}</strong>? Anyone with this short link or QR code will no longer reach the destination.</p>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="modal = false" /><UButton label="Delete link" color="error" :loading="deleting" @click="remove" />
      </template>
    </UModal>
  </article>
</template>
