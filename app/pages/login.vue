<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const route = useRoute();
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
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
  <UCard>
    <template #header>
      <h1 class="text-xl font-semibold">
        Sign in
      </h1>
    </template>
    <form class="space-y-4" @submit.prevent="submit">
      <UFormField label="Email">
        <UInput v-model="email" type="email" autocomplete="username" required />
      </UFormField>
      <UFormField label="Password">
        <UInput v-model="password" type="password" autocomplete="current-password" required />
      </UFormField>
      <p v-if="error" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton type="submit" label="Sign in" block :loading="loading" />
    </form>
  </UCard>
</template>
