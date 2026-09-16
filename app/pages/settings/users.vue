<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as v from 'valibot';

definePageMeta({ layout: 'default' });
useHead({ title: 'Users · Linkyard' });

interface AdminUser { id: string; email: string; name: string; role: string; isActive: boolean; isSuperAdmin: boolean; createdAt: string }

const { data, pending, error, refresh } = await useFetch<{ items: AdminUser[] }>('/api/admin/users');

const schema = v.object({
  email: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter an email.'), v.email('Enter a valid email.')),
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a name.')),
});

type Schema = v.InferOutput<typeof schema>;

const state = reactive({ email: '', name: '' });
const addOpen = ref(false);
const creating = ref(false);
const passwordOpen = ref(false);
const busyId = ref('');
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
  if (creating.value)
    return;
  creating.value = true;
  try {
    const res = await $fetch<{ initialPassword: string }>('/api/admin/users', {
      method: 'POST',
      body: { email: state.email, name: state.name },
    });
    lastPassword.value = res.initialPassword;
    state.email = '';
    state.name = '';
    addOpen.value = false;
    passwordOpen.value = true;
    await refresh();
  }
  catch (e) {
    showError(e);
  }
  finally {
    creating.value = false;
  }
}

async function toggleActive(id: string, isActive: boolean) {
  if (busyId.value)
    return;
  busyId.value = id;
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'PATCH', body: { isActive: !isActive } });
    await refresh();
  }
  catch (e) {
    showError(e);
  }
  finally {
    busyId.value = '';
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="page-heading">
      <div>
        <h1 class="page-title">
          Users
        </h1><p class="page-description">
          Manage who can access your company workspace.
        </p>
      </div>
      <UButton label="Add user" icon="i-lucide-user-plus" class="shrink-0" @click="addOpen = true" />
    </div>

    <USlideover
      v-model:open="addOpen"
      title="Add a user"
      description="Create an account and share its initial password with the user."
      :unmount-on-hide="false"
      :ui="{ content: 'sm:max-w-[480px]' }"
    >
      <template #body>
        <UForm
          :schema="schema"
          :state="state"
          :validate-on="[]"
          class="space-y-4"
          @submit="createUser"
        >
          <UFormField label="Email" name="email" required>
            <UInput v-model="state.email" type="email" placeholder="you@company.com" autocomplete="off" />
          </UFormField>
          <UFormField label="Name" name="name" required>
            <UInput v-model="state.name" placeholder="Full name" autocomplete="off" />
          </UFormField>
          <UButton type="submit" label="Add user" icon="i-lucide-user-plus" block :loading="creating" :disabled="creating" />
        </UForm>
      </template>
    </USlideover>

    <div v-if="pending" class="space-y-3" role="status" aria-label="Loading users">
      <USkeleton v-for="n in 4" :key="n" class="h-12 w-full" /><span class="sr-only">Loading users</span>
    </div>
    <div v-else-if="error">
      <UAlert title="Could not load users" description="Try again to load the user list." color="error" variant="soft" icon="i-lucide-circle-alert" /><UButton label="Try again" variant="outline" size="sm" class="mt-4" @click="refresh()" />
    </div>
    <p v-else-if="!data?.items.length" class="rounded-panel border border-default bg-default px-5 py-14 text-center text-sm text-muted">
      No users yet.
    </p>
    <UTable
      v-else
      :data="data.items"
      :columns="[
        { accessorKey: 'name', header: 'User' },
        { accessorKey: 'role', header: 'Role' },
        { accessorKey: 'isActive', header: 'Status' },
        { id: 'actions', header: '' },
      ]"
    >
      <template #name-cell="{ row }">
        <div class="min-w-0">
          <p class="truncate font-medium text-highlighted">
            {{ row.original.name }}
          </p><p class="truncate text-xs text-muted">
            {{ row.original.email }}
          </p>
        </div>
      </template>
      <template #role-cell="{ row }">
        {{ row.original.role === 'admin' ? 'Administrator' : 'Member' }}
      </template>
      <template #isActive-cell="{ row }">
        <UBadge :label="row.original.isActive ? 'Active' : 'Inactive'" :color="row.original.isActive ? 'success' : 'neutral'" variant="subtle" size="sm" />
      </template>
      <template #actions-cell="{ row }">
        <div class="text-right">
          <UTooltip :text="lockReason(row.original)" :disabled="!lockReason(row.original)">
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              :label="row.original.isActive ? 'Deactivate' : 'Activate'"
              :loading="busyId === row.original.id"
              :disabled="!!lockReason(row.original) || !!busyId"
              @click="toggleActive(row.original.id, row.original.isActive)"
            />
          </UTooltip>
        </div>
      </template>
    </UTable>

    <UModal v-model:open="passwordOpen" title="Initial password" description="Copy this password now. It is not shown again.">
      <template #body>
        <code class="block break-all rounded-md bg-elevated p-3 text-sm">{{ lastPassword }}</code>
      </template>
      <template #footer>
        <UButton :label="copied ? 'Copied' : 'Copy password'" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy(lastPassword)" />
      </template>
    </UModal>
  </div>
</template>
