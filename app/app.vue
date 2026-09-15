<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
    { rel: 'icon', href: '/favicon.ico' },
  ],
  htmlAttrs: { lang: 'en' },
});

useSeoMeta({
  title: 'Linkyard',
  description: 'Self-hosted link manager',
});
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
