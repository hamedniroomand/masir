<script setup lang="ts">
import * as v from 'valibot';

definePageMeta({ layout: 'auth' });

const route = useRoute();
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '');

const schema = v.object({
  password: v.pipe(v.string(), v.minLength(12, 'Use at least 12 characters.')),
});

const state = reactive({ password: '' });
const form = useTemplateRef('form');
useFormRevalidation(form, state);
const error = ref('');
const loading = ref(false);

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    await $fetch('/api/auth/reset', {
      method: 'POST',
      body: { token: token.value, password: state.password },
    });
    await navigateTo('/login');
  }
  catch {
    error.value = 'This recovery link is not valid. Ask for a new one.';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
      Set a new password
    </h1>
    <UForm ref="form" :schema="schema" :state="state" :validate-on="[]" class="mt-6 space-y-5" @submit="onSubmit">
      <UFormField label="New password" name="password" required>
        <UInput v-model="state.password" type="password" icon="i-lucide-lock-keyhole" autocomplete="new-password" />
      </UFormField>
      <p v-if="error" role="alert" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton type="submit" label="Save password" block :loading="loading" />
    </UForm>
  </div>
</template>
