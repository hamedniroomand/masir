<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';
import { normalizeSlug } from '../../shared/slug';

const emit = defineEmits<{ created: [link: LinkItem] }>();

const destinationUrl = ref('');
const slug = ref('');
const title = ref('');
const expiresAt = ref('');
const advanced = ref(false);
const loading = ref(false);
const destError = ref('');
const slugError = ref('');
const created = ref<LinkItem | null>(null);

const config = useRuntimeConfig();
const slugPreview = computed(() => normalizeSlug(slug.value || ''));

const { copy, copied } = useClipboard();

async function submit() {
  destError.value = '';
  slugError.value = '';
  loading.value = true;
  created.value = null;
  try {
    const body: Record<string, unknown> = { destinationUrl: destinationUrl.value };
    if (slug.value)
      body.slug = slugPreview.value;
    if (title.value)
      body.title = title.value;
    if (expiresAt.value)
      body.expiresAt = new Date(expiresAt.value).getTime();

    const link = await $fetch<LinkItem>('/api/links', { method: 'POST', body });
    created.value = link;
    emit('created', link);
    destinationUrl.value = '';
    slug.value = '';
    title.value = '';
    expiresAt.value = '';
  }
  catch (e: unknown) {
    const err = e as { statusCode?: number; data?: { reason?: string } };
    if (err.statusCode === 409)
      slugError.value = 'This short link is already taken.';
    else if (err.statusCode === 422)
      destError.value = err.data?.reason ?? 'Invalid input.';
    else if (err.statusCode === 429)
      destError.value = 'Too many links created. Try again later.';
    else
      destError.value = 'Could not create link.';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <UCard class="mb-6">
    <form class="space-y-4" @submit.prevent="submit">
      <UFormField label="Destination URL" :error="destError">
        <UInput v-model="destinationUrl" type="url" placeholder="https://example.com/page" required />
      </UFormField>
      <UButton type="button" variant="ghost" size="sm" @click="advanced = !advanced">
        {{ advanced ? 'Hide' : 'Show' }} advanced
      </UButton>
      <div v-if="advanced" class="space-y-3 border-t border-default pt-3">
        <UFormField :label="`Short link (${config.public.shortDomain}/…)`" :error="slugError">
          <UInput v-model="slug" placeholder="my-link" />
          <p v-if="slug" class="text-xs text-muted mt-1">
            Preview: {{ config.public.shortDomain }}/{{ slugPreview }}
          </p>
        </UFormField>
        <UFormField label="Title">
          <UInput v-model="title" />
        </UFormField>
        <UFormField label="Expires">
          <UInput v-model="expiresAt" type="datetime-local" />
        </UFormField>
      </div>
      <UButton type="submit" label="Create link" :loading="loading" />
    </form>
    <div v-if="created" class="mt-4 p-3 rounded-md bg-elevated space-y-2">
      <p class="font-medium">
        {{ created.shortUrl }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton size="sm" :label="copied ? 'Copied' : 'Copy'" @click="copy(created.shortUrl)" />
        <UButton size="sm" label="View details" :to="`/links/${created.id}`" />
      </div>
    </div>
  </UCard>
</template>
