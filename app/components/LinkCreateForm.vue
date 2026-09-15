<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';
import { normalizeSlug } from '#shared/slug';

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
  <div>
    <form class="space-y-5" @submit.prevent="submit">
      <UFormField label="Destination URL" :error="destError">
        <UInput v-model="destinationUrl" type="url" icon="i-lucide-globe" placeholder="https://example.com/page" size="lg" required />
      </UFormField>
      <UButton type="button" color="neutral" variant="ghost" size="sm" :trailing-icon="advanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" :aria-expanded="advanced || !!slugError" @click="advanced = !advanced">
        Customize link
      </UButton>
      <div v-if="advanced || slugError" class="space-y-3 border-t border-default pt-3">
        <UFormField :label="`Short link (${config.public.shortDomain}/…)`" :error="slugError">
          <UInput v-model="slug" placeholder="my-link" />
          <p v-if="slug" class="text-xs text-muted mt-1">
            Preview: {{ config.public.shortDomain }}/{{ slugPreview }}
          </p>
        </UFormField>
        <UFormField label="Title" description="A name to help you find this link.">
          <UInput v-model="title" />
        </UFormField>
        <UFormField label="Expiry date" description="Optional. The link stops working after this date.">
          <UInput v-model="expiresAt" type="datetime-local" />
        </UFormField>
      </div>
      <UButton type="submit" label="Create link" icon="i-lucide-plus" size="lg" block :loading="loading" />
    </form>
    <div v-if="created" role="status" class="mt-5 p-4 rounded-xl border border-success/20 bg-success/5 space-y-3">
      <p class="text-sm font-medium text-success">
        Link created
      </p>
      <p class="break-all text-sm font-medium">
        {{ created.shortUrl }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton size="sm" :label="copied ? 'Copied' : 'Copy'" @click="copy(created.shortUrl)" />
        <UButton size="sm" label="View details" :to="`/links/${created.id}`" />
      </div>
    </div>
  </div>
</template>
