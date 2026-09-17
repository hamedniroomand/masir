<script setup lang="ts">
const props = defineProps<{ email: string }>();

const resent = ref(false);
const resending = ref(false);
const showError = useErrorToast();

async function resend() {
  resending.value = true;
  try {
    await $fetch('/api/auth/verify/resend', { method: 'POST', body: { email: props.email } });
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
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
      Check your inbox
    </h1>
    <p class="mt-2 text-sm text-muted">
      We sent a verification link to {{ email }}.
    </p>
    <div class="mt-6 space-y-3">
      <UButton label="Resend email" variant="subtle" :disabled="resent" :loading="resending" block @click="resend" />
      <p v-if="resent" role="status" class="text-xs text-muted">
        We sent another link to {{ email }}.
      </p>
      <slot />
    </div>
  </div>
</template>
