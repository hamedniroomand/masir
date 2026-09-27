<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import type { LinkItem } from '~/composables/useLinks';
import * as v from 'valibot';
import { normalizeSlug, slugSchema } from '#shared/slug';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const schema = v.object({
  destinationUrl: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a destination URL.')),
  slug: slugSchema,
});

type Schema = v.InferOutput<typeof schema>;

const showError = useErrorToast();
const { saving, saved, patch } = useLinkPatch(() => props.link.id);

const state = reactive({ destinationUrl: '', slug: '' });
const keepOldSlug = ref(true);
const form = useTemplateRef('form');
const formRevalidation = useFormRevalidation(form, state);

watch(() => props.link, (link) => {
  state.destinationUrl = link.destinationUrl;
  state.slug = link.slug;
  form.value?.clear();
  formRevalidation.reset();
}, { immediate: true });

const slugChanged = computed(() => normalizeSlug(state.slug) !== props.link.slug);

watch([() => state.destinationUrl, () => state.slug], () => {
  saved.value = false;
});

async function save(_event: FormSubmitEvent<Schema>) {
  form.value?.clear();
  const body: Record<string, unknown> = { destinationUrl: state.destinationUrl };
  if (slugChanged.value) {
    body.slug = normalizeSlug(state.slug);
    body.keepOldSlug = keepOldSlug.value;
  }
  try {
    await patch(body);
    emit('updated');
  }
  catch (error: unknown) {
    const detail = error as { statusCode?: number };
    if (detail.statusCode === 409) {
      form.value?.setErrors([{ name: 'slug', message: errorReason(error, 'This short link is already taken.') }]);
      return;
    }
    if (detail.statusCode !== 422) {
      showError(error);
      return;
    }
    form.value?.setErrors([{ name: 'destinationUrl', message: errorReason(error, 'Invalid URL.') }]);
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-sm font-semibold text-highlighted">
        Destination
      </h2><p class="mt-0.5 text-xs text-muted">
        Update where this link goes, or change its short address.
      </p>
    </template>
    <UForm
      ref="form"
      :schema="schema"
      :state="state"
      :validate-on="[]"
      @submit="save"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
        <UFormField name="destinationUrl" class="flex-1">
          <UInput
            v-model="state.destinationUrl"
            type="text"
            inputmode="url"
            autocomplete="url"
            aria-label="Destination URL"
            icon="i-lucide-globe"
          />
        </UFormField>
        <UButton type="submit" label="Save changes" :loading="saving" />
      </div>
      <div class="mt-4 border-t border-default pt-4">
        <UFormField name="slug" label="Short address" description="Change the part after the slash. Keep the old address and every copy you already shared still works.">
          <UInput v-model="state.slug" aria-label="Short address" icon="i-lucide-link" />
        </UFormField>
        <UCheckbox v-if="slugChanged" v-model="keepOldSlug" class="mt-3" :label="`Keep /${link.slug} working as an alias`" />
      </div>
    </UForm>
    <p v-if="saved" role="status" class="mt-3 flex items-center gap-1.5 text-xs text-success">
      <UIcon name="i-lucide-circle-check" class="size-3.5" />Destination saved
    </p>
  </UCard>
</template>
