<script setup lang="ts">
interface Workspace { id: string; name: string; slug: string; logoUrl: string | null; role: string; url: string }

const { data } = await useFetch<{ items: Workspace[] }>('/api/workspaces');
const config = useRuntimeConfig();
const rootHost = computed(() => new URL(config.public.shortDomain).host);

const current = computed(() => data.value?.items[0] ?? null);
const name = ref('');
const message = ref('');
const error = ref('');
const saving = ref(false);
const confirming = ref(false);

watch(current, (w) => {
  if (w)
    name.value = w.name;
}, { immediate: true });

async function save() {
  error.value = '';
  message.value = '';
  saving.value = true;
  try {
    await $fetch('/api/workspaces', { method: 'PATCH', body: { name: name.value } });
    message.value = 'Saved.';
  }
  catch (e) {
    error.value = (e as { data?: { data?: { reason?: string } } }).data?.data?.reason
      ?? 'We could not save the workspace.';
  }
  finally {
    saving.value = false;
  }
}

async function remove() {
  error.value = '';
  try {
    await $fetch('/api/workspaces', { method: 'DELETE' });
    await navigateTo('/login');
  }
  catch (e) {
    error.value = (e as { data?: { data?: { reason?: string } } }).data?.data?.reason
      ?? 'We could not delete the workspace.';
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

    <div v-if="current?.role === 'OWNER'" class="space-y-3">
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
