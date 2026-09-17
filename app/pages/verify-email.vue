<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const route = useRoute();
const email = computed(() => typeof route.query.email === 'string' ? route.query.email : '');
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '');

const state = ref<'pending' | 'verifying' | 'failed'>(token.value ? 'verifying' : 'pending');
const resent = ref(false);
const resending = ref(false);
const showError = useErrorToast();

onMounted(async () => {
  if (!token.value)
    return;
  try {
    await $fetch('/api/auth/verify', { method: 'POST', body: { token: token.value } });
    await navigateTo('/');
  }
  catch {
    state.value = 'failed';
  }
});

async function resend() {
  resending.value = true;
  try {
    await $fetch('/api/auth/verify/resend', { method: 'POST', body: { email: email.value } });
    resent.value = true;
  }
  catch (error) {
    showError(error);
  }
  finally {
    resending.value = false;
  }
}
</script>

<template>
  <Transition
    mode="out-in"
    enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150 motion-reduce:transition-none"
    leave-to-class="opacity-0"
  >
    <div v-if="state === 'verifying'" key="verifying" class="flex flex-col items-center py-4 text-center">
      <UIcon name="i-lucide-link-2" class="brand-loader size-10 text-primary" aria-hidden="true" />
      <h1 class="mt-5 text-2xl font-semibold tracking-tight text-highlighted">
        Verifying your email
      </h1>
      <p role="status" class="mt-2 text-sm text-muted">
        One moment. We check your link.
      </p>
    </div>
    <div v-else key="ready">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        {{ state === 'failed' ? 'This link did not work' : 'Check your inbox' }}
      </h1>
      <p v-if="state === 'pending'" class="mt-2 text-sm text-muted">
        We sent a verification link to {{ email }}.
      </p>
      <UAlert
        v-else
        role="alert"
        class="mt-4"
        title="This verification link is not valid."
        description="The link expired or was used before. Ask for a new one."
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
      />
      <div class="mt-6 space-y-3">
        <UButton label="Resend email" variant="subtle" :disabled="!email || resent" :loading="resending" block @click="resend" />
        <p v-if="resent" role="status" class="text-xs text-muted">
          We sent another link to {{ email }}.
        </p>
        <UButton to="/login" label="Back to sign in" variant="ghost" block />
      </div>
    </div>
  </Transition>
</template>
