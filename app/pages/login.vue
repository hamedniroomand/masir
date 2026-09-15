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
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">
        Welcome back
      </h1>
      <p class="mt-3 text-sm text-muted">
        Sign in to manage your links.
      </p>
    </div>
    <form class="space-y-5" @submit.prevent="submit">
      <UFormField label="Email">
        <UInput v-model="email" type="email" icon="i-lucide-mail" placeholder="you@company.com" size="lg" autocomplete="username" required />
      </UFormField>
      <UFormField label="Password">
        <UInput v-model="password" type="password" icon="i-lucide-lock-keyhole" placeholder="Enter your password" size="lg" autocomplete="current-password" required />
      </UFormField>
      <p v-if="error" role="alert" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton type="submit" label="Sign in" trailing-icon="i-lucide-arrow-right" size="lg" block :loading="loading" />
    </form>
  </div>
</template>
