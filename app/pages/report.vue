<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

definePageMeta({ layout: 'auth' });

const schema = v.object({
  slug: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter the short link slug.')),
  reason: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a reason for your report.')),
});

type Schema = v.InferOutput<typeof schema>;

const state = reactive({
  slug: '',
  reason: '',
});

const done = ref(false);

const showError = useErrorToast();

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  try {
    await $fetch('/api/report', { method: 'POST', body: { slug: state.slug, reason: state.reason } });
    done.value = true;
  }
  catch (e) {
    showError(e);
  }
}
</script>

<template>
  <UCard>
    <template #header>
      Report a link
    </template>
    <p v-if="done" class="text-sm">
      Thank you. Your report was received.
    </p>
    <UForm v-else :schema="schema" :state="state" :validate-on="[]" class="space-y-3" @submit="onSubmit">
      <UFormField label="Short link slug" name="slug" required>
        <UInput v-model="state.slug" />
      </UFormField>
      <UFormField label="Reason" name="reason" required>
        <UTextarea v-model="state.reason" />
      </UFormField>
      <UButton type="submit" label="Submit" />
    </UForm>
  </UCard>
</template>
