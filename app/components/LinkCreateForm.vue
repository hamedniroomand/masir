<script setup lang="ts">
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui';
import type { LinkItem } from '~/composables/useLinks';
import * as v from 'valibot';
import { CAMPAIGN_UTM_CONFLICT, hasCampaignUtmConflict, MAX_NOTES_LENGTH, notesSchema, toVisitLimit } from '#shared/link-input';
import { normalizeSlug, slugSchema } from '#shared/slug';

const props = defineProps<{ initial?: { destinationUrl?: string; title?: string } }>();

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
  limitDestination: v.optional(v.pipe(v.string(), v.trim())),
  scheduledDestination: v.optional(v.pipe(v.string(), v.trim())),
  maximumVisits: v.optional(v.nullable(v.union([v.number(), v.literal('')]))),
  password: v.optional(v.pipe(v.string(), v.trim())),
  campaignId: v.optional(v.nullable(v.string())),
  utmSource: v.optional(v.pipe(v.string(), v.trim())),
  utmCampaign: v.optional(v.pipe(v.string(), v.trim())),
  utmTerm: v.optional(v.pipe(v.string(), v.trim())),
  utmContent: v.optional(v.pipe(v.string(), v.trim())),
  tags: v.optional(v.array(v.string())),
  notes: notesSchema,
});

const schema = v.pipe(fields, v.check(input => !hasCampaignUtmConflict(input), CAMPAIGN_UTM_CONFLICT));

type Schema = v.InferOutput<typeof schema>;

const state = reactive({
  destinationUrl: props.initial?.destinationUrl ?? '',
  slug: '',
  title: props.initial?.title ?? '',
  expiresAt: null as number | null,
  startsAt: null as number | null,
  expirationDestination: '',
  limitDestination: '',
  scheduledDestination: '',
  maximumVisits: null as number | null,
  password: '',
  campaignId: null as string | null,
  utmSource: '',
  utmCampaign: '',
  utmTerm: '',
  utmContent: '',
  tags: [] as string[],
  notes: '',
});

// A warning, never a block. Two links to one destination is a normal thing to
// want, so the submit button stays enabled.
const duplicate = ref<{ id: string; slug: string } | null>(null);

const checkDuplicate = useDebounceFn(async () => {
  duplicate.value = null;
  const value = state.destinationUrl.trim();
  if (!value || !URL.canParse(value.includes('://') ? value : `https://${value}`))
    return;
  try {
    const found = await $api<{ items: { id: string; slug: string }[] }>('/api/links', {
      query: { destination: value, limit: 1, perPage: 1 },
    });
    duplicate.value = found.items[0] ?? null;
  }
  catch {
    duplicate.value = null;
  }
}, 300);

watch(() => state.destinationUrl, () => {
  duplicate.value = null;
});

const groups = reactive({ tracking: false, access: false, tags: false });

const GROUP_OF_FIELD: Record<string, keyof typeof groups> = {
  notes: 'tags',
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
  limitDestination: 'access',
  scheduledDestination: 'access',
  tags: 'tags',
};

const form = useTemplateRef('form');
useFormRevalidation(form, state);
const loading = ref(false);
const created = ref<LinkItem | null>(null);

const config = useRuntimeConfig();
const slugPreview = computed(() => normalizeSlug(state.slug || ''));

const { copy, copied } = useClipboard();
const qrOpen = ref(false);

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
  duplicate.value = null;
  state.slug = '';
  state.title = '';
  state.expiresAt = null;
  state.startsAt = null;
  state.expirationDestination = '';
  state.limitDestination = '';
  state.scheduledDestination = '';
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
    if (state.limitDestination.trim())
      body.limitDestination = state.limitDestination.trim();
    if (state.scheduledDestination.trim())
      body.scheduledDestination = state.scheduledDestination.trim();
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
    if (state.notes.trim())
      body.notes = state.notes.trim();

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
      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex -space-x-px rounded-md shadow-xs">
          <UButton
            size="sm"
            :label="copied ? 'Copied' : 'Copy link'"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            color="neutral"
            variant="outline"
            class="rounded-e-none"
            @click="copy(created.shortUrl)"
          />
          <UButton
            size="sm"
            label="Download QR"
            icon="i-lucide-qr-code"
            color="neutral"
            variant="outline"
            class="rounded-none"
            @click="qrOpen = true"
          />
          <UTooltip text="Preview routing will be available in Release 2">
            <UButton
              size="sm"
              label="Preview routing"
              icon="i-lucide-play"
              color="neutral"
              variant="outline"
              class="rounded-s-none opacity-60"
              disabled
            />
          </UTooltip>
        </div>
        <UButton
          size="sm"
          label="View link"
          icon="i-lucide-external-link"
          color="neutral"
          variant="outline"
          :to="`/links/${created.id}`"
        />
        <UButton
          size="sm"
          label="Create another"
          icon="i-lucide-plus"
          variant="ghost"
          @click="created = null"
        />
      </div>
      <LinkQrSlideover
        v-if="created"
        v-model:open="qrOpen"
        :link-id="created.id"
        :short-url="created.shortUrl"
        :label="created.title || created.slug"
      />
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
          @blur="checkDuplicate"
        />
        <UAlert
          v-if="duplicate"
          color="warning"
          variant="soft"
          icon="i-lucide-info"
          class="mt-2"
          title="This destination already has a link"
        >
          <template #description>
            <NuxtLink :to="`/links/${duplicate.id}`" class="underline">
              /{{ duplicate.slug }}
            </NuxtLink> already points here. You can still create another one.
          </template>
        </UAlert>
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
            <UFormField v-if="state.startsAt" label="Before the start time" name="scheduledDestination" description="Optional. Send visitors here until the link opens.">
              <UInput v-model="state.scheduledDestination" type="url" inputmode="url" placeholder="https://example.com/coming-soon" />
            </UFormField>
            <UFormField label="Maximum visits" name="maximumVisits" description="Optional. Stop the link after this many redirects.">
              <LinkVisitLimitField v-model="state.maximumVisits" />
            </UFormField>
            <UFormField v-if="state.maximumVisits" label="After the visit cap" name="limitDestination" description="Optional. Send visitors here when the cap is used up.">
              <UInput v-model="state.limitDestination" type="url" inputmode="url" placeholder="https://example.com/sold-out" />
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
          label="Tags and notes"
          icon="i-lucide-tags"
        />
        <template #content>
          <UFormField name="tags" description="Group links for your dashboard." class="px-2 pb-2 pt-4">
            <LinkTagInput v-model="state.tags" />
          </UFormField>
          <UFormField name="notes" label="Notes" description="Only your workspace reads this." class="px-2 pb-2">
            <UTextarea v-model="state.notes" :rows="3" :maxlength="MAX_NOTES_LENGTH" autoresize class="w-full" />
          </UFormField>
        </template>
      </UCollapsible>

      <div class="border-t border-default pt-4">
        <UButton type="submit" label="Create link" icon="i-lucide-plus" block :loading="loading" />
      </div>
    </UForm>
  </div>
</template>
