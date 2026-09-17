<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

definePageMeta({ layout: 'auth' });

const { data: providers } = await useFetch('/api/auth/providers');

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
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    if (redirect) {
      // navigateTo throws on an absolute or protocol-relative value rather than
      // following it. The sign-in already succeeded, so land on the dashboard
      // instead of showing an error.
      try {
        await navigateTo(redirect);
      }
      catch {
        await navigateTo('/');
      }
      return;
    }

    // One workspace goes straight there. Several offer a choice. None means
    // this person has nowhere to land yet.
    const { items } = await $fetch<{ items: { url: string }[] }>('/api/workspaces');
    if (items.length === 1) {
      window.location.href = items[0]?.url ?? '/';
      return;
    }
    await navigateTo(items.length === 0 ? '/workspaces/new' : '/workspaces');
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
    <div class="mb-7">
      <div class="mb-6 flex size-11 items-center justify-center rounded-lg border border-default bg-muted/50 text-primary shadow-control">
        <UIcon name="i-lucide-log-in" class="size-5" />
      </div>
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        Welcome back
      </h1>
      <p class="mt-2 text-sm text-muted">
        Sign in to your link workspace.
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
        <UInput
          v-model="state.email"
          type="email"
          icon="i-lucide-mail"
          placeholder="you@company.com"
          autocomplete="username"
        />
      </UFormField>
      <UFormField label="Password" name="password" required>
        <UInput
          v-model="state.password"
          type="password"
          icon="i-lucide-lock-keyhole"
          placeholder="Enter your password"
          autocomplete="current-password"
        />
      </UFormField>
      <p v-if="error" role="alert" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton type="submit" label="Sign in" trailing-icon="i-lucide-arrow-right" block :loading="loading" />
    </UForm>
    <p class="mt-7 text-center text-xs text-muted">
      <ULink to="/forgot-password">
        Forgot your password?
      </ULink>
      <span class="mx-2">·</span>
      <ULink to="/register">
        Create an account
      </ULink>
    </p>
  </div>
</template>
