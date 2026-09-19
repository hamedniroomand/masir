<script setup lang="ts">
const { turnstileSiteKey } = useRuntimeConfig().public;
const turnstileToken = ref('');
const turnstile = useTemplateRef('turnstile');
const error = ref('');
const step = ref(-1);

// The server builds the whole demo in one transaction, so these steps pace the
// wait rather than report it. The last one is real: it ends when the URL lands.
const STEPS = ['Creating your workspace', 'Setting up your account', 'Adding sample links', 'Opening your dashboard'] as const;
const STEP_MS = 650;

const running = computed(() => step.value >= 0);

function wait(milliseconds: number) {
  return new Promise(done => setTimeout(done, milliseconds));
}

async function start() {
  error.value = '';
  step.value = 0;

  const pacing = (async () => {
    for (let index = 1; index < STEPS.length; index++) {
      await wait(STEP_MS);
      step.value = index;
    }
  })();

  try {
    const [{ url }] = await Promise.all([
      $fetch<{ url: string }>('/api/auth/demo', { method: 'POST', body: { turnstileToken: turnstileToken.value } }),
      pacing,
    ]);
    // The workspace lives on its own host, so this is a navigation, not a route.
    // The overlay stays up until the browser leaves the page.
    window.location.href = `${url}/dashboard`;
  }
  catch (failure) {
    step.value = -1;
    error.value = errorReason(failure, 'We could not start the demo. Try again.');
    turnstile.value?.reset();
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <UButton label="Try the demo" icon="i-lucide-play" size="lg" :loading="running" @click="start" />
    <TurnstileWidget v-if="turnstileSiteKey" ref="turnstile" v-model="turnstileToken" />
    <p v-if="error" class="text-sm text-error">
      {{ error }}
    </p>
    <LandingDemoOverlay v-if="running" :steps="STEPS" :current="step" />
  </div>
</template>
