<script setup lang="ts">
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui';
import type { LinkItem } from '~/composables/useLinks';
import * as v from 'valibot';
import { CAMPAIGN_UTM_CONFLICT, hasCampaignUtmConflict, toVisitLimit } from '#shared/link-input';
import { normalizeSlug, slugSchema } from '#shared/slug';

const emit = defineEmits<{ created: [link: LinkItem] }>();

const { $api } = useNuxtApp();

const fields = v.object({
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
  maximumVisits: v.optional(v.nullable(v.union([v.number(), v.literal('')]))),
  password: v.optional(v.pipe(v.string(), v.trim())),
  campaignId: v.optional(v.nullable(v.string())),
  utmSource: v.optional(v.pipe(v.string(), v.trim())),
  utmCampaign: v.optional(v.pipe(v.string(), v.trim())),
  utmTerm: v.optional(v.pipe(v.string(), v.trim())),
  utmContent: v.optional(v.pipe(v.string(), v.trim())),
  tags: v.optional(v.array(v.string())),
});

const schema = v.pipe(fields, v.check(input => !hasCampaignUtmConflict(input), CAMPAIGN_UTM_CONFLICT));

type Schema = v.InferOutput<typeof schema>;

const state = reactive({
  destinationUrl: '',
  slug: '',
  title: '',
  expiresAt: null as number | null,
  startsAt: null as number | null,
  expirationDestination: '',
  maximumVisits: null as number | null,
  password: '',
  campaignId: null as string | null,
  utmSource: '',
  utmCampaign: '',
  utmTerm: '',
  utmContent: '',
  tags: [] as string[],
});

const groups = reactive({ tracking: false, access: false, tags: false });

const GROUP_OF_FIELD: Record<string, keyof typeof groups> = {
  campaignId: 'tracking',
  utmSource: 'tracking',
  utmCampaign: 'tracking',
  utmTerm: 'tracking',
  utmContent: 'tracking',
  startsAt: 'access',
  expiresAt: 'access',
  maximumVisits: 'access',
  password: 'access',
  expirationDestination: 'access',
  tags: 'tags',
};

const form = useTemplateRef('form');
useFormRevalidation(form, state);
const loading = ref(false);
const created = ref<LinkItem | null>(null);

const config = useRuntimeConfig();
const slugPreview = computed(() => normalizeSlug(state.slug || ''));

const { copy, copied } = useClipboard();

function openGroupsFor(names: (string | undefined)[]) {
  for (const name of names) {
    const group = name ? GROUP_OF_FIELD[name] : undefined;
    if (group)
      groups[group] = true;
  }
}

function setErrors(errors: { name: string; message: string }[]) {
  openGroupsFor(errors.map(issue => issue.name));
  form.value?.setErrors(errors);
}

function reset() {
  state.destinationUrl = '';
  state.slug = '';
  state.title = '';
  state.expiresAt = null;
  state.startsAt = null;
  state.expirationDestination = '';
  state.maximumVisits = null;
  state.password = '';
  state.campaignId = null;
  state.utmSource = '';
  state.utmCampaign = '';
  state.utmTerm = '';
  state.utmContent = '';
  state.tags = [];
  groups.tracking = false;
  groups.access = false;
  groups.tags = false;
}

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
    const visitLimit = toVisitLimit(state.maximumVisits);
    if (visitLimit != null)
      body.maximumVisits = visitLimit;
    if (state.password)
      body.password = state.password;
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

    const link = await $api<LinkItem>('/api/links', { method: 'POST', body });
    created.value = link;
    emit('created', link);
    reset();
  }
  catch (error: unknown) {
    const err = error as { statusCode?: number };
    if (err.statusCode === 409) {
      setErrors([{ name: 'slug', message: 'This short link is already taken.' }]);
    }
    else if (err.statusCode === 422) {
      setErrors([{ name: 'destinationUrl', message: errorReason(error, 'Invalid input.') }]);
    }
    else if (err.statusCode === 429) {
      setErrors([{ name: 'destinationUrl', message: 'Too many links created. Try again later.' }]);
    }
    else {
      setErrors([{ name: 'destinationUrl', message: 'Could not create link.' }]);
    }
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div v-if="created" role="status" class="mb-5 space-y-3 rounded-panel border border-success/25 bg-success/5 p-4">
      <p class="flex items-center gap-2 text-sm font-medium text-success">
        <UIcon name="i-lucide-circle-check" class="size-4" />Link created
      </p>
      <p class="break-all text-sm font-medium text-highlighted">
        {{ created.shortUrl }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton size="sm" :label="copied ? 'Copied' : 'Copy'" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" color="neutral" variant="outline" @click="copy(created.shortUrl)" /><UButton size="sm" label="View link" icon="i-lucide-external-link" color="neutral" variant="outline" :to="`/links/${created.id}`" /><UButton size="sm" label="Create another" icon="i-lucide-plus" variant="ghost" @click="created = null" />
      </div>
    </div>
    <UForm
      ref="form"
      :schema="schema"
      :state="state"
      :validate-on="[]"
      class="space-y-5"
      @submit="onSubmit"
      @error="(event: FormErrorEvent) => openGroupsFor(event.errors.map(e => e.name))"
    >
      <UFormField label="Destination URL" name="destinationUrl" required>
        <UInput
          v-model="state.destinationUrl"
          type="text"
          inputmode="url"
          autocomplete="url"
          icon="i-lucide-globe"
          placeholder="https://example.com/page"
        />
      </UFormField>
      <UFormField label="Title" name="title" description="A name to help you find this link.">
        <UInput v-model="state.title" placeholder="Product launch" />
      </UFormField>
      <UFormField label="Short address" name="slug" :description="`Leave blank to generate an address under ${config.public.shortDomain}.`">
        <UInput v-model="state.slug" placeholder="my-link" />
        <p v-if="state.slug" class="mt-2 flex items-center gap-1.5 break-all text-xs text-primary">
          <UIcon name="i-lucide-link-2" class="size-3.5 shrink-0" />{{ config.public.shortDomain }}/{{ slugPreview }}
        </p>
      </UFormField>

      <UCollapsible v-model:open="groups.tracking" class="rounded-lg border border-default bg-muted/20 p-2">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          class="w-full"
          :trailing-icon="groups.tracking ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :ui="{ trailingIcon: 'ms-auto' }"
          label="Campaign and tracking"
          icon="i-lucide-megaphone"
        />
        <template #content>
          <div class="px-2 pb-2 pt-4">
            <LinkUtmFields
              v-model:campaign-id="state.campaignId"
              v-model:utm-source="state.utmSource"
              v-model:utm-campaign="state.utmCampaign"
              v-model:utm-term="state.utmTerm"
              v-model:utm-content="state.utmContent"
              :destination-url="state.destinationUrl"
            />
          </div>
        </template>
      </UCollapsible>

      <UCollapsible v-model:open="groups.access" class="rounded-lg border border-default bg-muted/20 p-2">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          class="w-full"
          :trailing-icon="groups.access ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :ui="{ trailingIcon: 'ms-auto' }"
          label="Access and schedule"
          icon="i-lucide-shield-check"
        />
        <template #content>
          <div class="space-y-4 px-2 pb-2 pt-4">
            <LinkScheduleFields v-model:starts-at="state.startsAt" v-model:expires-at="state.expiresAt" />
            <UFormField label="Maximum visits" name="maximumVisits" description="Optional. Stop the link after this many redirects.">
              <LinkVisitLimitField v-model="state.maximumVisits" />
            </UFormField>
            <UFormField label="Password" name="password" description="Optional. Visitors must enter it before the redirect.">
              <UInput v-model="state.password" type="password" autocomplete="new-password" placeholder="No password" />
            </UFormField>
            <UFormField label="Expiration destination" name="expirationDestination" description="Optional. Send visitors here when the link expires.">
              <UInput v-model="state.expirationDestination" type="url" inputmode="url" placeholder="https://example.com/expired" />
            </UFormField>
          </div>
        </template>
      </UCollapsible>

      <UCollapsible v-model:open="groups.tags" class="rounded-lg border border-default bg-muted/20 p-2">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          class="w-full"
          :trailing-icon="groups.tags ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :ui="{ trailingIcon: 'ms-auto' }"
          label="Tags"
          icon="i-lucide-tags"
        />
        <template #content>
          <UFormField name="tags" description="Group links for your dashboard." class="px-2 pb-2 pt-4">
            <LinkTagInput v-model="state.tags" />
          </UFormField>
        </template>
      </UCollapsible>

      <div class="border-t border-default pt-4">
        <UButton type="submit" label="Create link" icon="i-lucide-plus" block :loading="loading" />
      </div>
    </UForm>
  </div>
</template>
