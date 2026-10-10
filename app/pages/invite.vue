<script setup lang="ts">
import * as v from 'valibot';
import { accountPasswordSchema } from '#shared/account-password';

definePageMeta({ layout: 'auth' });

type Preview = { workspaceName: string; email: string; role: string; accountExists: boolean };

const { $api } = useNuxtApp();
const route = useRoute();
const { loggedIn, fetch: fetchSession } = useUserSession();
const token = typeof route.query.token === 'string' ? route.query.token : '';

const { data: preview, error: previewError } = await useApi<Preview>('/api/workspaces/invitations/preview', { query: { token } });

// An existing account signs in first. The full path keeps the token.
if (preview.value?.accountExists && !loggedIn.value)
  await navigateTo(loginPath(route.fullPath));

const schema = v.object({ password: accountPasswordSchema });
const state = reactive({ password: '' });
const error = ref('');
const loading = ref(false);

async function join() {
  error.value = '';
  loading.value = true;
  try {
    await $api('/api/workspaces/invitations/accept', {
      method: 'POST',
      body: loggedIn.value ? { token } : { token, password: state.password },
    });
    await fetchSession();
    // A full load, so the layout reads the new membership.
    window.location.href = '/dashboard';
  }
  catch (failure) {
    error.value = errorReason(failure, 'This invitation link is not valid.');
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
      Join the workspace
    </h1>
    <template v-if="previewError || !preview">
      <p role="alert" class="mt-2 text-sm text-error">
        This invitation link is not valid.
      </p>
      <UButton to="/login" label="Back to sign in" variant="subtle" block class="mt-6" />
    </template>
    <template v-else>
      <p class="mt-2 text-sm text-muted">
        You are invited to {{ preview.workspaceName }} as {{ preview.email }}.
      </p>
      <UForm v-if="!loggedIn" :schema="schema" :state="state" class="mt-6 space-y-5" @submit="join">
        <UFormField label="Password" name="password" required>
          <UInput v-model="state.password" type="password" icon="i-lucide-lock-keyhole" autocomplete="new-password" />
        </UFormField>
        <PasswordRules :value="state.password" />
        <p v-if="error" role="alert" class="text-sm text-error">
          {{ error }}
        </p>
        <UButton type="submit" label="Join the workspace" block :loading="loading" />
      </UForm>
      <template v-else>
        <p v-if="error" role="alert" class="mt-4 text-sm text-error">
          {{ error }}
        </p>
        <UButton label="Join the workspace" block class="mt-6" :loading="loading" @click="join" />
      </template>
    </template>
  </div>
</template>
