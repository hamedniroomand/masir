<script setup lang="ts">
type Member = { id: string; email: string; role: string; isActive: boolean };
type Invitation = { id: string; email: string; expiresAt: string };

const { data: members, refresh: refreshMembers } = await useFetch<{ items: Member[] }>('/api/workspaces/members');
const { data: invites, refresh: refreshInvites } = await useFetch<{ items: Invitation[] }>('/api/workspaces/invitations');

const inviteEmail = ref('');
const error = ref('');
const busy = ref(false);

function reason(failure: unknown, fallback: string) {
  return (failure as { data?: { data?: { reason?: string } } }).data?.data?.reason ?? fallback;
}

async function run(action: () => Promise<unknown>, fallback: string) {
  error.value = '';
  busy.value = true;
  try {
    await action();
    await Promise.all([refreshMembers(), refreshInvites()]);
  }
  catch (failure) {
    error.value = reason(failure, fallback);
  }
  finally {
    busy.value = false;
  }
}

function invite() {
  return run(async () => {
    await $fetch('/api/workspaces/invitations', { method: 'POST', body: { email: inviteEmail.value } });
    inviteEmail.value = '';
  }, 'We could not send the invitation.');
}

function revoke(id: string) {
  return run(
    () => $fetch(`/api/workspaces/invitations/${id}`, { method: 'DELETE' }),
    'We could not revoke the invitation.',
  );
}

function resend(id: string) {
  return run(
    () => $fetch(`/api/workspaces/invitations/${id}/resend`, { method: 'POST' }),
    'We could not resend the invitation.',
  );
}

function setActive(id: string, isActive: boolean) {
  return run(
    () => $fetch(`/api/workspaces/members/${id}`, { method: 'PATCH', body: { isActive } }),
    'We could not change this member.',
  );
}

function removeMember(id: string) {
  return run(
    () => $fetch(`/api/workspaces/members/${id}`, { method: 'DELETE' }),
    'We could not remove this member.',
  );
}

function transfer(id: string) {
  return run(
    () => $fetch('/api/workspaces/transfer-ownership', { method: 'POST', body: { memberId: id } }),
    'We could not transfer ownership.',
  );
}
</script>

<template>
  <div class="max-w-2xl space-y-8">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">
        Members
      </h1>
      <p class="mt-1 text-sm text-muted">
        A workspace has one owner. Everyone else is a member.
      </p>
    </div>

    <p v-if="error" role="alert" class="text-sm text-error">
      {{ error }}
    </p>

    <div class="flex gap-2">
      <UInput v-model="inviteEmail" type="email" icon="i-lucide-mail" placeholder="teammate@example.com" class="flex-1" />
      <UButton label="Invite" :loading="busy" @click="invite" />
    </div>

    <ul class="divide-y divide-default rounded-lg border border-default">
      <li v-for="m in members?.items ?? []" :key="m.id" class="flex items-center justify-between gap-3 p-4">
        <div class="min-w-0">
          <p class="truncate text-sm text-highlighted">
            {{ m.email }}
          </p>
          <p class="text-xs text-muted">
            {{ m.role === 'OWNER' ? 'Owner' : 'Member' }}<span v-if="!m.isActive"> · Deactivated</span>
          </p>
        </div>
        <div v-if="m.role !== 'OWNER'" class="flex shrink-0 gap-1">
          <UButton :label="m.isActive ? 'Deactivate' : 'Reactivate'" size="xs" variant="ghost" @click="setActive(m.id, !m.isActive)" />
          <UButton label="Make owner" size="xs" variant="ghost" @click="transfer(m.id)" />
          <UButton label="Remove" size="xs" variant="ghost" color="error" @click="removeMember(m.id)" />
        </div>
      </li>
    </ul>

    <div v-if="(invites?.items ?? []).length">
      <h2 class="mb-2 text-sm font-medium text-highlighted">
        Pending invitations
      </h2>
      <ul class="divide-y divide-default rounded-lg border border-default">
        <li v-for="i in invites?.items ?? []" :key="i.id" class="flex items-center justify-between gap-3 p-4">
          <span class="truncate text-sm text-highlighted">{{ i.email }}</span>
          <div class="flex shrink-0 gap-1">
            <UButton label="Resend" size="xs" variant="ghost" @click="resend(i.id)" />
            <UButton label="Revoke" size="xs" variant="ghost" color="error" @click="revoke(i.id)" />
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
