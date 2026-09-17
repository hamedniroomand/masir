<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const password = ref('');
const errorMessage = ref('');
const loading = ref(false);

const { data: meta, error } = await useFetch(() => `/api/links/public/${slug.value}`);

useHead({ title: () => `${meta.value?.title || slug.value} · Password · Masir` });

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
  catch (failure: unknown) {
    const err = failure as { statusCode?: number; statusMessage?: string };
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
  <UAlert v-if="error" title="Link not found" description="This short link does not exist." color="error" variant="soft" icon="i-lucide-circle-alert" />
  <div v-else>
    <div class="mb-7">
      <div class="mb-6 flex size-11 items-center justify-center rounded-lg border border-default bg-muted/50 text-primary shadow-control">
        <UIcon name="i-lucide-lock-keyhole" class="size-5" />
      </div>
      <h1 class="break-words text-2xl font-semibold tracking-tight text-highlighted">
        {{ meta?.title || 'Protected link' }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        Enter the password to continue.
      </p>
    </div>
    <form class="space-y-5" @submit.prevent="submit">
      <UFormField label="Password">
        <UInput v-model="password" type="password" autocomplete="current-password" />
      </UFormField>
      <p v-if="errorMessage" class="text-sm text-error" role="alert">
        {{ errorMessage }}
      </p>
      <UButton type="submit" label="Continue" trailing-icon="i-lucide-arrow-right" block :loading="loading" />
    </form>
  </div>
</template>
