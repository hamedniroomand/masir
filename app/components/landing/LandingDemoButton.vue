<script setup lang="ts">
const { turnstileSiteKey } = useRuntimeConfig().public;
const turnstileToken = ref('');
const turnstile = useTemplateRef('turnstile');
const loading = ref(false);
const error = ref('');

async function start() {
  error.value = '';
  loading.value = true;
  try {
    const { url } = await $fetch<{ url: string }>('/api/auth/demo', { method: 'POST', body: { turnstileToken: turnstileToken.value } });
    // The workspace lives on its own host, so this is a navigation, not a route.
    window.location.href = `${url}/dashboard`;
  }
  catch (failure) {
    error.value = errorReason(failure, 'We could not start the demo. Try again.');
    turnstile.value?.reset();
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <UButton label="Try the demo" icon="i-lucide-play" size="lg" :loading="loading" @click="start" />
    <TurnstileWidget v-if="turnstileSiteKey" ref="turnstile" v-model="turnstileToken" />
    <p v-if="error" class="text-sm text-error">
      {{ error }}
    </p>
  </div>
</template>
