<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const route = useRoute();
const { loggedIn } = useUserSession();
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '');

const state = ref<'working' | 'done' | 'failed'>('working');
const error = ref('');

onMounted(async () => {
  if (!token.value) {
    state.value = 'failed';
    error.value = 'This invitation link is not valid.';
    return;
  }
  // The token survives the sign-in round trip in the redirect query.
  if (!loggedIn.value) {
    await navigateTo(`/login?redirect=${encodeURIComponent(`/invite?token=${token.value}`)}`);
    return;
  }
  try {
    const res = await $fetch<{ workspace: { slug: string } | null }>('/api/workspaces/invitations/accept', {
      method: 'POST',
      body: { token: token.value },
    });
    state.value = 'done';
    const workspaces = await $fetch<{ items: { slug: string; url: string }[] }>('/api/workspaces');
    const joined = workspaces.items.find(w => w.slug === res.workspace?.slug);
    window.location.href = joined?.url ?? '/';
  }
  catch (e) {
    state.value = 'failed';
    error.value = (e as { data?: { data?: { reason?: string } } }).data?.data?.reason
      ?? 'This invitation link is not valid.';
  }
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
      Join the workspace
    </h1>
    <p v-if="state === 'working'" class="mt-2 text-sm text-muted">
      Checking your invitation.
    </p>
    <p v-else-if="state === 'done'" class="mt-2 text-sm text-muted">
      You are in. Taking you to the workspace.
    </p>
    <template v-else>
      <p role="alert" class="mt-2 text-sm text-error">
        {{ error }}
      </p>
      <UButton to="/login" label="Back to sign in" variant="subtle" block class="mt-6" />
    </template>
  </div>
</template>
