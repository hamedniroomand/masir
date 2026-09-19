<script setup lang="ts">
const props = defineProps<{ expiresAt: string }>();

const INSTALL_GUIDE = 'https://hamedniroomand.github.io/masir/guide/installation';

const hoursLeft = computed(() => Math.max(0, Math.ceil((new Date(props.expiresAt).getTime() - Date.now()) / 3_600_000)));
</script>

<template>
  <UAlert
    icon="i-lucide-flask-conical"
    color="primary"
    variant="subtle"
    title="Demo workspace"
    :description="`It is deleted in ${hoursLeft} hours. Install Masir to keep your links.`"
    :actions="[{ label: 'Install Masir', to: INSTALL_GUIDE, target: '_blank', color: 'primary', variant: 'solid' }]"
    class="mb-6"
  />
</template>
