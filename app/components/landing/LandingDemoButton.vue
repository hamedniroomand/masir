<script setup lang="ts">
const { turnstileSiteKey } = useRuntimeConfig().public;
const turnstileToken = ref('');
const turnstile = useTemplateRef('turnstile');
const error = ref('');
const step = ref(-1);
const loading = ref(false);
const { user, fetch: fetchSession } = useUserSession();

// The server builds the whole demo in one transaction, so these steps pace the
// wait rather than report it. The last one is real: it ends when the URL lands.
const STEPS = ['Creating your workspace', 'Setting up your account', 'Adding sample links', 'Opening your dashboard'] as const;
const STEP_MS = 650;

const running = computed(() => step.value >= 0);

// Back from the workspace restores this page from the bfcache with its state
// frozen, which would show the overlay and the spinner over a page nobody is
// leaving.
useEventListener('pageshow', (event: PageTransitionEvent) => {
  if (!event.persisted)
    return;
  step.value = -1;
  loading.value = false;
});

function wait(milliseconds: number) {
  return new Promise(done => setTimeout(done, milliseconds));
}

async function paceSteps() {
  step.value = 0;
  for (let index = 1; index < STEPS.length; index++) {
    await wait(STEP_MS);
    step.value = index;
  }
}

async function start() {
  error.value = '';
  loading.value = true;

  try {
    // The robot check runs while the button spins, before the overlay, so a
    // box Cloudflare opens is never hidden behind it.
    if (turnstileSiteKey)
      await turnstile.value?.execute();
    // A visitor who holds a live demo gets it back at once. The steps would
    // claim work the server does not do.
    await fetchSession();
    const pacing = user.value?.demo ? Promise.resolve() : paceSteps();
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
    loading.value = false;
    error.value = errorReason(failure, 'We could not start the demo. Try again.');
    turnstile.value?.reset();
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <UButton label="Try the demo" icon="i-lucide-play" size="lg" :loading="loading" @click="start" />
    <TurnstileWidget v-if="turnstileSiteKey" ref="turnstile" v-model="turnstileToken" execution="execute" />
    <p v-if="error" class="text-sm text-error">
      {{ error }}
    </p>
    <LandingDemoOverlay v-if="running" :steps="STEPS" :current="step" />
  </div>
</template>
