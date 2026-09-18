<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { RevalidatingForm } from '#imports';
import * as v from 'valibot';
import { accountPasswordSchema } from '#shared/account-password';

definePageMeta({ layout: 'auth' });

const route = useRoute();
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '');

const schema = v.object({ password: accountPasswordSchema });

type Schema = v.InferOutput<typeof schema>;

const fields: AuthFormField[] = [
  { name: 'password', type: 'password', label: 'New password', icon: 'i-lucide-lock-keyhole', autocomplete: 'new-password', required: true },
];

// UAuthForm owns the form state. Without this annotation the type of auth
// comes from the template, which reads password back out of auth.
type AuthFormRef = { state: { password?: string }; formRef: RevalidatingForm | null };
const auth = useTemplateRef<AuthFormRef>('auth');
const password = computed(() => auth.value?.state.password ?? '');
useFormRevalidation(computed(() => auth.value?.formRef), () => auth.value?.state);

const error = ref('');
const loading = ref(false);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  error.value = '';
  loading.value = true;
  try {
    await $fetch('/api/auth/reset', {
      method: 'POST',
      body: { token: token.value, password: event.data.password },
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
    <UAuthForm
      ref="auth"
      class="mt-6"
      :schema="schema"
      :fields="fields"
      :validate-on="[]"
      :loading="loading"
      :submit="{ label: 'Save password' }"
      @submit="onSubmit"
    >
      <template #password-help>
        <PasswordRules :value="password" />
      </template>
      <template #validation>
        <p v-if="error" role="alert" class="text-sm text-error">
          {{ error }}
        </p>
      </template>
    </UAuthForm>
  </div>
</template>
