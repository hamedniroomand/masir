<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const showError = useErrorToast();
const password = ref('');
const saving = ref(false);
const removing = ref(false);

async function patchPassword(value: string | null) {
  await $fetch(`/api/links/${props.link.id}`, { method: 'PATCH', body: { password: value } });
  password.value = '';
  emit('updated');
}

async function save() {
  if (!password.value)
    return;
  saving.value = true;
  try {
    await patchPassword(password.value);
  }
  catch (e) {
    showError(e);
  }
  finally {
    saving.value = false;
  }
}

async function remove() {
  removing.value = true;
  try {
    await patchPassword(null);
  }
  catch (e) {
    showError(e);
  }
  finally {
    removing.value = false;
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <UBadge
        :color="link.isProtected ? 'primary' : 'neutral'"
        variant="subtle"
        size="sm"
        :label="link.isProtected ? 'Password protected' : 'No password'"
        :icon="link.isProtected ? 'i-lucide-lock' : 'i-lucide-lock-open'"
      />
    </div>
    <p class="text-xs leading-5 text-muted">
      {{ link.isProtected
        ? 'Visitors must enter the password before the redirect. Enter a new password to replace it.'
        : 'Set a password to ask visitors for it before the redirect.' }}
    </p>
    <div class="flex flex-col gap-2 sm:flex-row">
      <UInput
        v-model="password"
        type="password"
        autocomplete="new-password"
        :placeholder="link.isProtected ? 'New password' : 'Password'"
        :aria-label="link.isProtected ? 'New password' : 'Password'"
        class="sm:max-w-64"
      />
      <UButton
        :label="link.isProtected ? 'Replace password' : 'Set password'"
        :disabled="!password"
        :loading="saving"
        @click="save"
      />
      <UButton
        v-if="link.isProtected"
        label="Remove password"
        color="neutral"
        variant="outline"
        :loading="removing"
        @click="remove"
      />
    </div>
  </div>
</template>
