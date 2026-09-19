<script setup lang="ts">
// The layout comes from app/middleware/auth.global.ts: none for the landing
// page, default for the links list.
definePageMeta({ layout: false });

const { data: host } = await useHostInfo();
</script>

<template>
  <LandingPage v-if="host?.landing" :app-url="host.appUrl" :registration="host.registration" />
  <LinkListPage v-else />
</template>
