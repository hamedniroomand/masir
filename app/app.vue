<script setup lang="ts">
const socialImage = `${useRequestURL().origin}/og-image.png`;

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
    { rel: 'icon', href: '/favicon.ico' },
  ],
  htmlAttrs: { lang: 'en' },
});

useSeoMeta({
  title: 'Masir',
  description: 'Every link has a destination.',
  ogType: 'website',
  ogTitle: 'Masir · Every link has a destination.',
  ogDescription: 'Open-source link management for teams.',
  ogImage: socialImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Masir · Every link has a destination.',
  twitterDescription: 'Open-source link management for teams.',
  twitterImage: socialImage,
});
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
