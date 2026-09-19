<script setup lang="ts">
defineProps<{ appUrl: string; registration: boolean }>();

useSeoMeta({
  title: 'Masir · Every link has a destination.',
  description: 'A self-hosted link manager for teams. Short links your team owns, destinations you can change after sharing, and analytics that never store a visitor IP.',
  robots: 'index, follow',
});
</script>

<template>
  <div class="relative isolate flex min-h-dvh flex-col bg-[var(--workspace-bg)] text-default">
    <LandingHeader :app-url="appUrl" :registration="registration" />
    <main class="flex-1">
      <LandingHero :app-url="appUrl" :registration="registration" />
      <LandingDashboard />
      <LandingFeatures />
      <LandingPrivacy />
      <LandingCallToAction :app-url="appUrl" :registration="registration" />
    </main>
    <LandingFooter />
  </div>
</template>
