<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

definePageMeta({ layout: 'auth' });

const { data: providers } = await useFetch('/api/auth/providers');

const schema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email('Enter a valid email.')),
  password: v.pipe(v.string(), v.minLength(12, 'Use at least 12 characters.')),
});

type Schema = v.InferOutput<typeof schema>;

const state = reactive({ email: '', password: '' });
const error = ref('');
const loading = ref(false);

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  error.value = '';
  loading.value = true;
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: state.email, password: state.password },
    });
    await navigateTo(`/verify-email?email=${encodeURIComponent(state.email)}`);
  }
  catch {
    error.value = 'We could not complete the registration. Try again.';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-7">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        Create your account
      </h1>
      <p class="mt-2 text-sm text-muted">
        Start with your email address.
      </p>
    </div>
    <div v-if="providers?.google || providers?.microsoft" class="mb-5 space-y-3">
      <UButton
        v-if="providers?.google"
        to="/api/auth/google"
        external
        label="Continue with Google"
        icon="i-simple-icons-google"
        variant="subtle"
        block
      />
      <UButton
        v-if="providers?.microsoft"
        to="/api/auth/microsoft"
        external
        label="Continue with Microsoft"
        icon="i-simple-icons-microsoft"
        variant="subtle"
        block
      />
      <USeparator label="or" />
    </div>
    <UForm :schema="schema" :state="state" :validate-on="[]" class="space-y-5" @submit="onSubmit">
      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" type="email" icon="i-lucide-mail" autocomplete="username" />
      </UFormField>
      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" type="password" icon="i-lucide-lock-keyhole" autocomplete="new-password" />
      </UFormField>
      <p v-if="error" role="alert" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton type="submit" label="Create account" block :loading="loading" />
    </UForm>
    <p class="mt-7 text-center text-xs text-muted">
      Already have an account?
      <ULink to="/login">
        Sign in
      </ULink>
    </p>
  </div>
</template>
