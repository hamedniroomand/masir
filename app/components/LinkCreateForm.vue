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
  startsAt: v.optional(v.nullable(v.number())),
  expirationDestination: v.optional(v.pipe(v.string(), v.trim())),
  maximumVisits: v.optional(v.nullable(v.number())),
  campaignId: v.optional(v.nullable(v.string())),
  utmSource: v.optional(v.pipe(v.string(), v.trim())),
  utmCampaign: v.optional(v.pipe(v.string(), v.trim())),
  utmTerm: v.optional(v.pipe(v.string(), v.trim())),
  utmContent: v.optional(v.pipe(v.string(), v.trim())),
  tags: v.optional(v.array(v.string())),
});

type Schema = v.InferOutput<typeof schema>;

const state = reactive({
  destinationUrl: '',
  slug: '',
  title: '',
  expiresAt: null as number | null,
  startsAt: null as number | null,
  expirationDestination: '',
  maximumVisits: null as number | null,
  campaignId: null as string | null,
  utmSource: '',
  utmCampaign: '',
  utmTerm: '',
  utmContent: '',
  tags: [] as string[],
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
    if (state.startsAt != null)
      body.startsAt = state.startsAt;
    if (state.maximumVisits != null)
      body.maximumVisits = state.maximumVisits;
    if (state.expirationDestination.trim())
      body.expirationDestination = state.expirationDestination.trim();
    if (state.campaignId)
      body.campaignId = state.campaignId;
    if (state.utmSource)
      body.utmSource = state.utmSource;
    if (state.utmCampaign)
      body.utmCampaign = state.utmCampaign;
    if (state.utmTerm)
      body.utmTerm = state.utmTerm;
    if (state.utmContent)
      body.utmContent = state.utmContent;
    if (state.tags.length)
      body.tags = state.tags;

    const link = await $fetch<LinkItem>('/api/links', { method: 'POST', body });
    created.value = link;
    emit('created', link);
    state.destinationUrl = '';
    state.slug = '';
    state.title = '';
    state.expiresAt = null;
    state.startsAt = null;
    state.expirationDestination = '';
    state.maximumVisits = null;
    state.campaignId = null;
    state.utmSource = '';
    state.utmCampaign = '';
    state.utmTerm = '';
    state.utmContent = '';
    state.tags = [];
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
        <LinkScheduleFields v-model:starts-at="state.startsAt" v-model:expires-at="state.expiresAt" />
        <UFormField label="Maximum visits" name="maximumVisits" description="Optional. Stop the link after this many redirects.">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <UInput v-model.number="state.maximumVisits" type="number" min="1" placeholder="No limit" class="sm:max-w-40" />
            <UButton type="button" label="One-time link" color="neutral" variant="outline" size="sm" @click="state.maximumVisits = 1" />
          </div>
        </UFormField>
        <UFormField label="Expiration destination" name="expirationDestination" description="Optional. Send visitors here when the link expires.">
          <UInput v-model="state.expirationDestination" type="url" inputmode="url" placeholder="https://example.com/expired" />
        </UFormField>
        <UFormField label="Tags" name="tags" description="Group links for your dashboard.">
          <LinkTagInput v-model="state.tags" />
        </UFormField>
        <div class="border-t border-default pt-3">
          <LinkUtmFields
            v-model:campaign-id="state.campaignId"
            v-model:utm-source="state.utmSource"
            v-model:utm-campaign="state.utmCampaign"
            v-model:utm-term="state.utmTerm"
            v-model:utm-content="state.utmContent"
            :destination-url="state.destinationUrl"
          />
        </div>
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
