<script setup lang="ts">
import * as v from 'valibot';

definePageMeta({ layout: 'auth' });

const schema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email('Enter a valid email.')),
});

const state = reactive({ email: '' });
const message = ref('');
const loading = ref(false);

async function onSubmit() {
  loading.value = true;
  const res = await $fetch<{ message: string }>('/api/auth/forgot', {
    method: 'POST',
    body: { email: state.email },
  });
  message.value = res.message;
  loading.value = false;
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
      Reset your password
    </h1>
    <p class="mt-2 text-sm text-muted">
      Enter your email address.
    </p>
    <UForm :schema="schema" :state="state" :validate-on="[]" class="mt-6 space-y-5" @submit="onSubmit">
      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" type="email" icon="i-lucide-mail" autocomplete="username" />
      </UFormField>
      <UButton type="submit" label="Send recovery link" block :loading="loading" />
    </UForm>
    <p v-if="message" class="mt-5 text-sm text-muted">
      {{ message }}
    </p>
    <p class="mt-7 text-center text-xs text-muted">
      <ULink to="/login">
        Back to sign in
      </ULink>
    </p>
  </div>
</template>
