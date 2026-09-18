<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { RevalidatingForm } from '#imports';
import * as v from 'valibot';
import { accountPasswordSchema } from '#shared/account-password';

definePageMeta({ layout: 'auth' });

const { data: providers } = await useFetch('/api/auth/providers');
if (!providers.value?.registration)
  await navigateTo('/login', { replace: true });
const hasProviders = computed(() => Boolean(providers.value?.google || providers.value?.microsoft));
const showEmailForm = ref(!hasProviders.value);

const schema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email('Enter a valid email.')),
  password: accountPasswordSchema,
});

type Schema = v.InferOutput<typeof schema>;

const fields: AuthFormField[] = [
  { name: 'email', type: 'email', label: 'Email', icon: 'i-lucide-mail', autocomplete: 'username', required: true },
  { name: 'password', type: 'password', label: 'Password', icon: 'i-lucide-lock-keyhole', autocomplete: 'new-password', required: true },
];

// UAuthForm owns the form state. Without this annotation the type of auth
// comes from the template, which reads password back out of auth.
type AuthFormRef = { state: { password?: string }; formRef: RevalidatingForm | null };
const auth = useTemplateRef<AuthFormRef>('auth');
const password = computed(() => auth.value?.state.password ?? '');
useFormRevalidation(computed(() => auth.value?.formRef), () => auth.value?.state);

const error = ref('');
const loading = ref(false);
const sentTo = ref('');

async function onSubmit(event: FormSubmitEvent<Schema>) {
  error.value = '';
  loading.value = true;
  try {
    await $fetch('/api/auth/register', { method: 'POST', body: event.data });
    sentTo.value = event.data.email;
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
  <VerifyEmailNotice v-if="sentTo" :email="sentTo">
    <UButton to="/login" label="Back to sign in" variant="ghost" block />
  </VerifyEmailNotice>
  <div v-else>
    <div class="mb-7">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        Create your account
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ hasProviders ? 'Choose how you want to sign up.' : 'Start with your email address.' }}
      </p>
    </div>
    <div v-if="hasProviders && providers" class="mb-5">
      <AuthProviders :providers="providers" />
      <USeparator v-if="showEmailForm" label="or" class="mt-5" />
      <p v-else class="mt-5 text-center text-sm text-muted">
        <UButton variant="link" class="p-0" label="Sign up with email instead" @click="showEmailForm = true" />
      </p>
    </div>
    <UAuthForm
      v-if="showEmailForm"
      ref="auth"
      :schema="schema"
      :fields="fields"
      :validate-on="[]"
      :loading="loading"
      :submit="{ label: 'Create account' }"
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
    <p class="mt-7 text-center text-xs text-muted">
      Already have an account?
      <ULink to="/login">
        Sign in
      </ULink>
    </p>
  </div>
</template>
