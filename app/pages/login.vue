<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

definePageMeta({ layout: 'auth' });

const route = useRoute();

const schema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, 'Enter your email.'),
    v.email('Enter a valid email.'),
  ),
  password: v.pipe(
    v.string(),
    v.minLength(1, 'Enter your password.'),
  ),
});

type Schema = v.InferOutput<typeof schema>;

const state = reactive({
  email: '',
  password: '',
});

const error = ref('');
const loading = ref(false);

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  error.value = '';
  loading.value = true;
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: state.email, password: state.password },
    });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await navigateTo(redirect);
  }
  catch {
    error.value = 'Invalid email or password.';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">
        Welcome back
      </h1>
      <p class="mt-3 text-sm text-muted">
        Sign in to manage your links.
      </p>
    </div>
    <UForm :schema="schema" :state="state" :validate-on="[]" class="space-y-5" @submit="onSubmit">
      <UFormField label="Email" name="email" required>
        <UInput
          v-model="state.email"
          type="email"
          icon="i-lucide-mail"
          placeholder="you@company.com"
          size="lg"
          autocomplete="username"
        />
      </UFormField>
      <UFormField label="Password" name="password" required>
        <UInput
          v-model="state.password"
          type="password"
          icon="i-lucide-lock-keyhole"
          placeholder="Enter your password"
          size="lg"
          autocomplete="current-password"
        />
      </UFormField>
      <p v-if="error" role="alert" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton type="submit" label="Sign in" trailing-icon="i-lucide-arrow-right" size="lg" block :loading="loading" />
    </UForm>
  </div>
</template>
