<script setup lang="ts">
type Identity = { id: string; provider: string; createdAt: string };

const { data, refresh } = await useFetch<{ items: Identity[] }>('/api/auth/identities');
const { data: providers } = await useFetch('/api/auth/providers');
const error = ref('');

const connected = computed(() => new Set((data.value?.items ?? []).map(i => i.provider)));

async function disconnect(id: string) {
  error.value = '';
  try {
    await $fetch(`/api/auth/identities/${id}`, { method: 'DELETE' });
    await refresh();
  }
  catch (failure) {
    error.value = (failure as { data?: { data?: { reason?: string } } }).data?.data?.reason
      ?? 'We could not disconnect this method.';
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">
        Sign-in methods
      </h1>
      <p class="mt-1 text-sm text-muted">
        Connect more than one method so you never lose access.
      </p>
    </div>

    <p v-if="error" role="alert" class="text-sm text-error">
      {{ error }}
    </p>

    <ul class="divide-y divide-default rounded-lg border border-default">
      <li v-for="item in data?.items ?? []" :key="item.id" class="flex items-center justify-between p-4">
        <span class="text-sm text-highlighted">{{ item.provider }}</span>
        <UButton label="Disconnect" size="xs" variant="ghost" color="error" @click="disconnect(item.id)" />
      </li>
    </ul>

    <div class="space-y-3">
      <UButton
        v-if="providers?.google && !connected.has('GOOGLE')"
        to="/api/auth/google"
        external
        label="Connect Google"
        variant="subtle"
        block
      />
      <UButton
        v-if="providers?.microsoft && !connected.has('MICROSOFT')"
        to="/api/auth/microsoft"
        external
        label="Connect Microsoft"
        variant="subtle"
        block
      />
    </div>
  </div>
</template>
