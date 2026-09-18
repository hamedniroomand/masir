<script setup lang="ts">
import * as v from 'valibot';

const querySchema = v.object({ token: v.pipe(v.string(), v.minLength(1)) });

definePageMeta({
  layout: 'auth',
  middleware: to => v.is(querySchema, to.query) ? undefined : navigateTo('/login'),
});

const route = useRoute();
const { fetch: fetchSession } = useUserSession();
const failed = ref(false);

onMounted(async () => {
  try {
    await $fetch('/api/auth/verify', { method: 'POST', body: { token: route.query.token } });
    // Verifying signs the person in. The route middleware reads the session it
    // already has, so refresh it before the next navigation.
    await fetchSession();
    await navigateTo('/');
  }
  catch {
    failed.value = true;
  }
});
</script>

<template>
  <Transition
    mode="out-in"
    enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150 motion-reduce:transition-none"
    leave-to-class="opacity-0"
  >
    <div v-if="failed" key="failed">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        This link did not work
      </h1>
      <UAlert
        role="alert"
        class="mt-4"
        title="This verification link is not valid."
        description="The link expired or was used before. Sign in to ask for a new one."
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
      />
      <UButton to="/login" label="Back to sign in" variant="ghost" class="mt-6" block />
    </div>
    <div v-else key="verifying" class="flex flex-col items-center py-4 text-center">
      <UIcon name="i-lucide-link-2" class="brand-loader size-10 text-primary" aria-hidden="true" />
      <h1 class="mt-5 text-2xl font-semibold tracking-tight text-highlighted">
        Verifying your email
      </h1>
      <p role="status" class="mt-2 text-sm text-muted">
        One moment. We check your link.
      </p>
    </div>
  </Transition>
</template>
