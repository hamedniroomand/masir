<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

definePageMeta({ layout: 'auth' });
useHead({ title: 'Report a link · Linkyard' });

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
const loading = ref(false);

const showError = useErrorToast();

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  if (loading.value)
    return;
  loading.value = true;
  try {
    await $fetch('/api/report', { method: 'POST', body: { slug: state.slug, reason: state.reason } });
    done.value = true;
  }
  catch (error) {
    showError(error);
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-7">
      <div class="mb-6 flex size-11 items-center justify-center rounded-lg border border-default bg-muted/50 text-primary shadow-control">
        <UIcon name="i-lucide-flag" class="size-5" />
      </div>
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        Report a link
      </h1>
      <p class="mt-2 text-sm text-muted">
        Tell the workspace administrator about a short link that breaks the rules.
      </p>
    </div>
    <UAlert v-if="done" title="Report received" description="Thank you. The administrator will review it." color="success" variant="soft" icon="i-lucide-circle-check" />
    <UForm v-else :schema="schema" :state="state" :validate-on="[]" class="space-y-5" @submit="onSubmit">
      <UFormField label="Short link slug" name="slug" required>
        <UInput v-model="state.slug" placeholder="my-link" />
      </UFormField>
      <UFormField label="Reason" name="reason" required>
        <UTextarea v-model="state.reason" :rows="4" class="w-full" placeholder="Tell us what is wrong with this link." />
      </UFormField>
      <UButton type="submit" label="Send report" trailing-icon="i-lucide-arrow-right" block :loading="loading" />
    </UForm>
  </div>
</template>
