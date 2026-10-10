<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const signOut = useSignOut();
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
      No access
    </h1>
    <p class="mt-2 text-sm text-muted">
      Your account is not a member of this workspace. Ask an owner to send you an invitation.
    </p>
    <UButton label="Sign out" variant="subtle" block class="mt-6" @click="signOut" />
  </div>
</template>
