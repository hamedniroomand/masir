<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const slug = ref('');
const reason = ref('');
const done = ref(false);

async function submit() {
  await $fetch('/api/report', { method: 'POST', body: { slug: slug.value, reason: reason.value } });
  done.value = true;
}
</script>

<template>
  <UCard>
    <template #header>
      Report a link
    </template>
    <p v-if="done" class="text-sm">
      Thank you. Your report was received.
    </p>
    <form v-else class="space-y-3" @submit.prevent="submit">
      <UFormField label="Short link slug">
        <UInput v-model="slug" required />
      </UFormField>
      <UFormField label="Reason">
        <UTextarea v-model="reason" required />
      </UFormField>
      <UButton type="submit" label="Submit" />
    </form>
  </UCard>
</template>
