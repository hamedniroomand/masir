<script setup lang="ts">
type Workspace = { id: string; name: string; slug: string; logoUrl: string | null; role: string; url: string };

const { $api } = useNuxtApp();

const { data, refresh } = await useApi<{ currentId: string | null; items: Workspace[]; multiWorkspace: boolean }>('/api/workspaces');
const config = useRuntimeConfig();
const rootHost = computed(() => new URL(config.public.shortDomain).host);

const current = computed(() => data.value?.items.find(workspace => workspace.id === data.value?.currentId) ?? null);
const name = ref('');
const message = ref('');
const error = ref('');
const saving = ref(false);
const confirming = ref(false);
const logoFile = ref<File | null>(null);
const logoBusy = ref(false);

watch(current, (workspace) => {
  if (workspace)
    name.value = workspace.name;
}, { immediate: true });

function reasonOf(failure: unknown) {
  return (failure as { data?: { data?: { reason?: string } } }).data?.data?.reason;
}

async function save() {
  error.value = '';
  message.value = '';
  saving.value = true;
  try {
    await $api('/api/workspaces', { method: 'PATCH', body: { name: name.value } });
    message.value = 'Saved.';
  }
  catch (failure) {
    error.value = reasonOf(failure) ?? 'We could not save the workspace.';
  }
  finally {
    saving.value = false;
  }
}

// The logo route takes the workspace id, because it also serves the onboarding
// page on the root domain, where the host names no workspace.
async function saveLogo(request: () => Promise<unknown>, done: string, fallback: string) {
  error.value = '';
  message.value = '';
  logoBusy.value = true;
  try {
    await request();
    await refresh();
    message.value = done;
  }
  catch (failure) {
    error.value = reasonOf(failure) ?? fallback;
  }
  finally {
    logoFile.value = null;
    logoBusy.value = false;
  }
}

watch(logoFile, (file) => {
  if (!file || !current.value)
    return;
  const body = new FormData();
  body.set('workspaceId', current.value.id);
  body.set('file', file);
  saveLogo(() => $api('/api/workspaces/logo', { method: 'POST', body }), 'Logo saved.', 'We could not save the logo.');
});

function removeLogo() {
  if (!current.value?.logoUrl)
    return;
  const body = { workspaceId: current.value.id };
  saveLogo(() => $api('/api/workspaces/logo', { method: 'DELETE', body }), 'Logo removed.', 'We could not remove the logo.');
}

async function remove() {
  error.value = '';
  try {
    await $api('/api/workspaces', { method: 'DELETE' });
    // Still signed in, so /login would bounce back to the deleted workspace.
    await navigateTo('/workspaces');
  }
  catch (failure) {
    error.value = reasonOf(failure) ?? 'We could not delete the workspace.';
  }
}
</script>

<template>
  <div class="max-w-xl space-y-8">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">
        Workspace
      </h1>
      <p class="mt-1 text-sm text-muted">
        The name your team sees. The address cannot change.
      </p>
    </div>

    <div class="space-y-5">
      <UFormField v-if="current?.role === 'OWNER'" label="Logo">
        <WorkspaceLogoField v-model="logoFile" :name="name" :url="current?.logoUrl ?? null" :busy="logoBusy" @remove="removeLogo" />
      </UFormField>
      <UFormField label="Workspace name">
        <UInput v-model="name" icon="i-lucide-building-2" />
      </UFormField>
      <UFormField label="Workspace address">
        <UInput :model-value="current?.slug ?? ''" disabled>
          <template #trailing>
            <span class="text-xs text-muted">.{{ rootHost }}</span>
          </template>
        </UInput>
        <template #help>
          <span class="text-xs text-muted">Every published short link uses this address.</span>
        </template>
      </UFormField>
      <p v-if="error" role="alert" class="text-sm text-error">
        {{ error }}
      </p>
      <p v-else-if="message" class="text-sm text-muted">
        {{ message }}
      </p>
      <UButton label="Save" :loading="saving" @click="save" />
    </div>

    <USeparator />

    <div v-if="current?.role === 'OWNER' && data?.multiWorkspace" class="space-y-3">
      <h2 class="text-sm font-medium text-highlighted">
        Delete this workspace
      </h2>
      <p class="text-sm text-muted">
        Its links stop working and its address stops resolving.
      </p>
      <UButton v-if="!confirming" label="Delete workspace" color="error" variant="subtle" @click="confirming = true" />
      <div v-else class="flex gap-2">
        <UButton label="Yes, delete it" color="error" @click="remove" />
        <UButton label="Cancel" variant="ghost" @click="confirming = false" />
      </div>
    </div>
  </div>
</template>
