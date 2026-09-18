<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

definePageMeta({ layout: 'auth' });

const { data: providers } = await useFetch('/api/auth/providers');
const hasProviders = computed(() => Boolean(providers.value?.google || providers.value?.microsoft));
const showEmailForm = ref(!hasProviders.value);

const route = useRoute();
const { fetch: fetchSession } = useUserSession();

const { turnstileSiteKey } = useRuntimeConfig().public;
const turnstileToken = ref('');
const turnstile = useTemplateRef('turnstile');

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
const form = useTemplateRef('form');
useFormRevalidation(form, state);

const error = ref('');
const loading = ref(false);

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  error.value = '';
  loading.value = true;
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: state.email, password: state.password, turnstileToken: turnstileToken.value },
    });
    // The route middleware reads the session it already has. Without this the
    // next client-side navigation still looks signed out and bounces back here.
    await fetchSession();
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

    const { items } = await $fetch<{ items: { url: string }[] }>('/api/workspaces');
    await landInWorkspace(items);
  }
  catch (failure) {
    error.value = errorReason(failure, 'Invalid email or password.');
    turnstile.value?.reset();
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
    <div v-if="hasProviders && providers" class="mb-5">
      <AuthProviders :providers="providers" />
      <USeparator v-if="showEmailForm" label="or" class="mt-5" />
      <p v-else class="mt-5 text-center text-sm text-muted">
        <UButton variant="link" class="p-0" label="Sign in with email instead" @click="showEmailForm = true" />
      </p>
    </div>
    <UForm v-if="showEmailForm" ref="form" :schema="schema" :state="state" :validate-on="[]" class="space-y-5" @submit="onSubmit">
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
      <TurnstileWidget v-if="turnstileSiteKey" ref="turnstile" v-model="turnstileToken" />
      <p v-if="error" role="alert" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton type="submit" label="Sign in" trailing-icon="i-lucide-arrow-right" block :loading="loading" :disabled="Boolean(turnstileSiteKey) && !turnstileToken" />
    </UForm>
    <p class="mt-7 text-center text-xs text-muted">
      <ULink to="/forgot-password">
        Forgot your password?
      </ULink>
      <template v-if="providers?.registration">
        <span class="mx-2">·</span>
        <ULink to="/register">
          Create an account
        </ULink>
      </template>
    </p>
  </div>
</template>
