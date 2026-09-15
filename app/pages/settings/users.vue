<script setup lang="ts">
definePageMeta({ layout: 'default' });

const { user } = useUserSession();
if (user.value?.role !== 'admin')
  throw createError({ statusCode: 403 });

interface AdminUser { id: string; email: string; name: string; role: string; isActive: boolean; createdAt: string }

const { data, refresh } = await useFetch<{ items: AdminUser[] }>('/api/admin/users');
const email = ref('');
const name = ref('');
const open = ref(false);
const lastPassword = ref('');
const { copy, copied } = useClipboard();

async function createUser() {
  const res = await $fetch<{ initialPassword: string }>('/api/admin/users', {
    method: 'POST',
    body: { email: email.value, name: name.value },
  });
  lastPassword.value = res.initialPassword;
  open.value = true;
  email.value = '';
  name.value = '';
  await refresh();
}

async function toggleActive(id: string, isActive: boolean) {
  await $fetch(`/api/admin/users/${id}`, { method: 'PATCH', body: { isActive: !isActive } });
  await refresh();
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">
        Users
      </h1><p class="mt-2 text-sm text-muted">
        Manage who can access your company workspace.
      </p>
    </div>
    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Add a user
        </h2><p class="mt-1 text-sm text-muted">
          Create an account and share its initial password with the user.
        </p>
      </template>
      <form class="grid gap-3 sm:grid-cols-3" @submit.prevent="createUser">
        <UInput v-model="email" type="email" placeholder="Email" aria-label="User email" required />
        <UInput v-model="name" placeholder="Name" aria-label="User name" required />
        <UButton type="submit" label="Add user" icon="i-lucide-user-plus" />
      </form>
    </UCard>
    <UTable
      v-if="data?.items"
      :data="data.items"
      :columns="[
        { accessorKey: 'email', header: 'Email' },
        { accessorKey: 'role', header: 'Role' },
        { accessorKey: 'isActive', header: 'Active' },
        { id: 'actions', header: '' },
      ]"
    >
      <template #isActive-cell="{ row }">
        {{ row.original.isActive ? 'Yes' : 'No' }}
      </template>
      <template #actions-cell="{ row }">
        <UButton
          size="xs"
          :label="row.original.isActive ? 'Deactivate' : 'Activate'"
          @click="toggleActive(row.original.id, row.original.isActive)"
        />
      </template>
    </UTable>
    <UModal v-model:open="open" title="Initial password">
      <template #body>
        <p class="mb-2 text-sm">
          Copy this password now. It will not be shown again.
        </p>
        <code class="block p-2 bg-elevated rounded">{{ lastPassword }}</code>
      </template>
      <template #footer>
        <UButton :label="copied ? 'Copied' : 'Copy'" @click="copy(lastPassword)" />
      </template>
    </UModal>
  </div>
</template>
