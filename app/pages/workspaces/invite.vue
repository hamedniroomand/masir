<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const emails = ref<string[]>(['']);
const sent = ref<string[]>([]);
const error = ref('');
const loading = ref(false);

function addRow() {
  emails.value.push('');
}

// The step is optional. Skipping it completes onboarding.
async function send() {
  error.value = '';
  loading.value = true;
  const wanted = emails.value.map(e => e.trim()).filter(Boolean);
  try {
    for (const email of wanted) {
      await $fetch('/api/workspaces/invitations', { method: 'POST', body: { email } });
      sent.value.push(email);
    }
    await navigateTo('/');
  }
  catch (e) {
    error.value = (e as { data?: { data?: { reason?: string } } }).data?.data?.reason
      ?? 'We could not send every invitation.';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-7">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        Invite your team
      </h1>
      <p class="mt-2 text-sm text-muted">
        Everyone you invite joins as a member. You can do this later.
      </p>
    </div>
    <div class="space-y-3">
      <UInput
        v-for="(_, index) in emails"
        :key="index"
        v-model="emails[index]"
        type="email"
        icon="i-lucide-mail"
        placeholder="teammate@example.com"
      />
      <UButton label="Add another" icon="i-lucide-plus" variant="ghost" size="xs" @click="addRow" />
    </div>
    <p v-if="error" role="alert" class="mt-4 text-sm text-error">
      {{ error }}
    </p>
    <div class="mt-6 space-y-3">
      <UButton label="Send invites" block :loading="loading" @click="send" />
      <UButton to="/" label="Skip for now" variant="ghost" block />
    </div>
  </div>
</template>
