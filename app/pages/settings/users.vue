<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

definePageMeta({ layout: 'default' });

interface AdminUser { id: string; email: string; name: string; role: string; isActive: boolean; isSuperAdmin: boolean; createdAt: string }

const { data, refresh } = await useFetch<{ items: AdminUser[] }>('/api/admin/users');

const schema = v.object({
  email: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter an email.'), v.email('Enter a valid email.')),
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a name.')),
});

type Schema = v.InferOutput<typeof schema>;

const state = reactive({ email: '', name: '' });
const open = ref(false);
const lastPassword = ref('');
const { copy, copied } = useClipboard();
const showError = useErrorToast();

const activeAdmins = computed(() => data.value?.items.filter(u => u.role === 'admin' && u.isActive).length ?? 0);
const { user: currentUser } = useUserSession();

function lockReason(user: AdminUser): string {
  if (user.isSuperAdmin && user.id !== currentUser.value?.id)
    return 'Only the super admin can change their own account.';
  if (user.role === 'admin' && user.isActive && activeAdmins.value <= 1)
    return 'Your workspace must keep one active admin.';
  return '';
}

async function createUser(_event: FormSubmitEvent<Schema>) {
  try {
    const res = await $fetch<{ initialPassword: string }>('/api/admin/users', {
      method: 'POST',
      body: { email: state.email, name: state.name },
    });
    lastPassword.value = res.initialPassword;
    open.value = true;
    state.email = '';
    state.name = '';
    await refresh();
  }
  catch (e) {
    showError(e);
  }
}

async function toggleActive(id: string, isActive: boolean) {
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'PATCH', body: { isActive: !isActive } });
    await refresh();
  }
  catch (e) {
    showError(e);
  }
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
      <UForm
        :schema="schema"
        :state="state"
        :validate-on="[]"
        class="flex flex-col gap-3 sm:flex-row sm:items-start"
        @submit="createUser"
      >
        <UFormField name="email" class="min-w-0 flex-1">
          <UInput v-model="state.email" type="email" placeholder="Email" aria-label="User email" />
        </UFormField>
        <UFormField name="name" class="min-w-0 flex-1">
          <UInput v-model="state.name" placeholder="Name" aria-label="User name" />
        </UFormField>
        <UButton
          type="submit"
          label="Add user"
          icon="i-lucide-user-plus"
          class="w-full shrink-0 sm:w-auto sm:mt-0"
        />
      </UForm>
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
        <UTooltip :text="lockReason(row.original)" :disabled="!lockReason(row.original)">
          <UButton
            size="xs"
            :label="row.original.isActive ? 'Deactivate' : 'Activate'"
            :disabled="!!lockReason(row.original)"
            @click="toggleActive(row.original.id, row.original.isActive)"
          />
        </UTooltip>
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
