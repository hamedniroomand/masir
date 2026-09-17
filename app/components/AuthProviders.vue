<script setup lang="ts">
defineProps<{ providers: { google: boolean; microsoft: boolean } }>();
</script>

<template>
  <div class="space-y-3">
    <UButton
      v-if="providers.google"
      to="/api/auth/google"
      external
      label="Continue with Google"
      icon="i-simple-icons-google"
      variant="subtle"
      block
    />
    <UButton
      v-if="providers.microsoft"
      to="/api/auth/microsoft"
      external
      label="Continue with Microsoft"
      icon="i-simple-icons-microsoft"
      variant="subtle"
      block
    />
  </div>
</template>
