<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import type { LinkItem } from '~/composables/useLinks';
import * as v from 'valibot';
import { normalizeSlug, slugSchema } from '#shared/slug';

const emit = defineEmits<{ created: [link: LinkItem] }>();

const schema = v.object({
  destinationUrl: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, 'Enter a destination URL.'),
  ),
  slug: v.optional(v.union([v.literal(''), slugSchema])),
  title: v.optional(v.pipe(v.string(), v.trim())),
  expiresAt: v.optional(v.nullable(v.number())),
});

type Schema = v.InferOutput<typeof schema>;

const state = reactive({
  destinationUrl: '',
  slug: '',
  title: '',
  expiresAt: null as number | null,
});

const form = useTemplateRef('form');
const advanced = ref(false);
const loading = ref(false);
const created = ref<LinkItem | null>(null);

const config = useRuntimeConfig();
const slugPreview = computed(() => normalizeSlug(state.slug || ''));

const { copy, copied } = useClipboard();

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  loading.value = true;
  created.value = null;
  form.value?.clear();
  try {
    const body: Record<string, unknown> = { destinationUrl: state.destinationUrl };
    if (state.slug)
      body.slug = slugPreview.value;
    if (state.title)
      body.title = state.title;
    if (state.expiresAt != null)
      body.expiresAt = state.expiresAt;

    const link = await $fetch<LinkItem>('/api/links', { method: 'POST', body });
    created.value = link;
    emit('created', link);
    state.destinationUrl = '';
    state.slug = '';
    state.title = '';
    state.expiresAt = null;
    advanced.value = false;
  }
  catch (e: unknown) {
    const err = e as { statusCode?: number; statusMessage?: string };
    if (err.statusCode === 409) {
      advanced.value = true;
      form.value?.setErrors([{ name: 'slug', message: 'This short link is already taken.' }]);
    }
    else if (err.statusCode === 422) {
      form.value?.setErrors([{ name: 'destinationUrl', message: err.statusMessage || 'Invalid input.' }]);
    }
    else if (err.statusCode === 429) {
      form.value?.setErrors([{ name: 'destinationUrl', message: 'Too many links created. Try again later.' }]);
    }
    else {
      form.value?.setErrors([{ name: 'destinationUrl', message: 'Could not create link.' }]);
    }
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <UForm
      ref="form"
      :schema="schema"
      :state="state"
      :validate-on="[]"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField label="Destination URL" name="destinationUrl" required>
        <UInput
          v-model="state.destinationUrl"
          type="text"
          inputmode="url"
          autocomplete="url"
          icon="i-lucide-globe"
          placeholder="https://example.com/page"
          size="lg"
        />
      </UFormField>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        size="sm"
        :trailing-icon="advanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        :aria-expanded="advanced"
        @click="advanced = !advanced"
      >
        Customize link
      </UButton>
      <div v-if="advanced" class="space-y-3 border-t border-default pt-3">
        <UFormField :label="`Short link (${config.public.shortDomain}/…)`" name="slug">
          <UInput v-model="state.slug" placeholder="my-link" />
          <p v-if="state.slug" class="text-xs text-muted mt-1">
            Preview: {{ config.public.shortDomain }}/{{ slugPreview }}
          </p>
        </UFormField>
        <UFormField label="Title" name="title" description="A name to help you find this link.">
          <UInput v-model="state.title" />
        </UFormField>
        <UFormField label="Expiry date" name="expiresAt" description="Optional. The link stops working after this date.">
          <LinkExpiryPicker v-model="state.expiresAt" />
        </UFormField>
      </div>
      <UButton type="submit" label="Create link" icon="i-lucide-plus" size="lg" block :loading="loading" />
    </UForm>
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
