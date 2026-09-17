<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import type { LinkItem } from '~/composables/useLinks';
import * as v from 'valibot';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const schema = v.object({
  destinationUrl: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a destination URL.')),
});

type Schema = v.InferOutput<typeof schema>;

const showError = useErrorToast();
const { saving, saved, patch } = useLinkPatch(() => props.link.id);

const state = reactive({ destinationUrl: '' });
const form = useTemplateRef('form');
useFormRevalidation(form, state);

watch(() => props.link, (link) => {
  state.destinationUrl = link.destinationUrl;
  form.value?.clear();
}, { immediate: true });

watch(() => state.destinationUrl, () => {
  saved.value = false;
});

async function save(_event: FormSubmitEvent<Schema>) {
  form.value?.clear();
  try {
    await patch({ destinationUrl: state.destinationUrl });
    emit('updated');
  }
  catch (error: unknown) {
    const detail = error as { statusCode?: number; statusMessage?: string };
    if (detail.statusCode !== 422) {
      showError(error);
      return;
    }
    form.value?.setErrors([{ name: 'destinationUrl', message: detail.statusMessage || 'Invalid URL.' }]);
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-sm font-semibold text-highlighted">
        Destination
      </h2><p class="mt-0.5 text-xs text-muted">
        Update where this link goes. Its short address stays the same.
      </p>
    </template>
    <UForm
      ref="form"
      :schema="schema"
      :state="state"
      :validate-on="[]"
      class="flex flex-col gap-3 sm:flex-row sm:items-start"
      @submit="save"
    >
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
    </UForm>
    <p v-if="saved" role="status" class="mt-3 flex items-center gap-1.5 text-xs text-success">
      <UIcon name="i-lucide-circle-check" class="size-3.5" />Destination saved
    </p>
  </UCard>
</template>
