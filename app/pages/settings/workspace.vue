<script setup lang="ts">
const { $api } = useNuxtApp();

const { data, refresh } = await useWorkspaces();
const config = useRuntimeConfig();
const rootHost = computed(() => new URL(config.public.shortDomain).host);

const current = computed(() => data.value?.items.find(workspace => workspace.id === data.value?.currentId) ?? null);
const { canManageLinks } = useCurrentWorkspace();

// A bookmarklet cannot read anything from this page, so the whole action lives
// in the href. The browser runs it on whatever page the person is reading.
const bookmarklet = computed(() => {
  const base = current.value?.url ?? '';
  return `javascript:location.href='${base}/links/new?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)`;
});
const name = ref('');
const linkPrefix = ref('');
const message = ref('');
const error = ref('');
const saving = ref(false);
const confirming = ref(false);
const logoFile = ref<File | null>(null);
const logoBusy = ref(false);

watch(current, (workspace) => {
  if (!workspace)
    return;
  name.value = workspace.name;
  linkPrefix.value = workspace.linkPrefix ?? '';
}, { immediate: true });

const linkExample = computed(() => {
  const path = linkPrefix.value.trim().replace(/^\/+|\/+$/g, '');
  return `${current.value?.url.replace(/^https?:\/\//, '') ?? ''}/${path ? `${path}/` : ''}abc123`;
});

function reasonOf(failure: unknown) {
  return (failure as { data?: { data?: { reason?: string } } }).data?.data?.reason;
}

async function save() {
  error.value = '';
  message.value = '';
  saving.value = true;
  try {
    await $api('/api/workspaces', { method: 'PATCH', body: { name: name.value, linkPrefix: linkPrefix.value } });
    await refresh();
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
      <UFormField label="Link path">
        <UInput v-model="linkPrefix" icon="i-lucide-route" placeholder="go" />
        <template #help>
          <span class="text-xs text-muted">Optional. Links look like {{ linkExample }}. Changing this breaks every link and QR code you have shared.</span>
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

    <div v-if="canManageLinks" class="space-y-3">
      <h2 class="text-sm font-semibold text-highlighted">
        Quick create
      </h2>
      <p class="text-sm text-muted">
        Drag this button to your bookmarks bar. Press it on any page and Masir
        opens the create form with that address and title already filled.
      </p>
      <a
        :href="bookmarklet"
        class="inline-flex items-center gap-2 rounded-lg border border-default bg-muted/40 px-3 py-2 text-sm font-medium text-highlighted"
        @click.prevent
      >
        <UIcon name="i-lucide-bookmark" class="size-4 text-primary" />Shorten with Masir
      </a>
    </div>

    <USeparator v-if="canManageLinks" />

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
