<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const route = useRoute();
const email = computed(() => typeof route.query.email === 'string' ? route.query.email : '');
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '');

const state = ref<'pending' | 'verifying' | 'done' | 'failed'>(token.value ? 'verifying' : 'pending');
const resent = ref(false);

onMounted(async () => {
  if (!token.value)
    return;
  try {
    await $fetch('/api/auth/verify', { method: 'POST', body: { token: token.value } });
    state.value = 'done';
    await navigateTo('/');
  }
  catch {
    state.value = 'failed';
  }
});

async function resend() {
  await $fetch('/api/auth/verify/resend', { method: 'POST', body: { email: email.value } });
  resent.value = true;
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
      Check your inbox
    </h1>
    <p v-if="state === 'pending'" class="mt-2 text-sm text-muted">
      We sent a verification link to {{ email }}.
    </p>
    <p v-else-if="state === 'verifying'" class="mt-2 text-sm text-muted">
      Verifying your email.
    </p>
    <p v-else-if="state === 'failed'" role="alert" class="mt-2 text-sm text-error">
      This verification link is not valid. Ask for a new one.
    </p>
    <div class="mt-6 space-y-3">
      <UButton label="Resend email" variant="subtle" :disabled="!email || resent" block @click="resend" />
      <p v-if="resent" class="text-xs text-muted">
        We sent another link.
      </p>
      <UButton to="/login" label="Sign out" variant="ghost" block />
    </div>
  </div>
</template>
