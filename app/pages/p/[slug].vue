<script setup lang="ts">
definePageMeta({ layout: 'default' });

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const password = ref('');
const errorMessage = ref('');
const loading = ref(false);

const { data: meta, error } = await useFetch(() => `/api/links/public/${slug.value}`);

useHead({ title: () => `${meta.value?.title || slug.value} · Password · Linkyard` });

async function submit() {
  errorMessage.value = '';
  loading.value = true;
  try {
    const result = await $fetch<{ redirectTo: string }>('/api/links/verify-password', {
      method: 'POST',
      body: { slug: slug.value, password: password.value },
    });
    await navigateTo(result.redirectTo, { external: true });
  }
  catch (e: unknown) {
    const err = e as { statusCode?: number; statusMessage?: string };
    if (err.statusCode === 401)
      errorMessage.value = 'Incorrect password.';
    else if (err.statusCode === 429)
      errorMessage.value = 'Too many attempts. Try again later.';
    else
      errorMessage.value = 'Could not verify password.';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-12">
    <div v-if="error" class="text-center">
      <UAlert title="Link not found" color="error" variant="soft" icon="i-lucide-circle-alert" />
    </div>
    <div v-else class="space-y-6 rounded-xl border border-default bg-default p-6">
      <div>
        <h1 class="text-xl font-semibold text-highlighted">
          {{ meta?.title || 'Protected link' }}
        </h1>
        <p class="mt-2 text-sm text-muted">
          Enter the password to continue.
        </p>
      </div>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Password">
          <UInput v-model="password" type="password" autocomplete="current-password" />
        </UFormField>
        <p v-if="errorMessage" class="text-sm text-error" role="alert">
          {{ errorMessage }}
        </p>
        <UButton type="submit" label="Continue" block :loading="loading" />
      </form>
    </div>
  </div>
</template>
