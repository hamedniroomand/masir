<script setup lang="ts">
const { user, clear } = useUserSession();

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' });
  await clear();
  await navigateTo('/login');
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-default px-4 py-3 flex items-center justify-between gap-4">
      <NuxtLink to="/" class="font-semibold text-lg">
        Linkyard
      </NuxtLink>
      <div class="flex items-center gap-2">
        <UButton to="/" label="Create link" size="sm" />
        <UDropdownMenu
          v-if="user"
          :items="[[
            ...(user.role === 'admin' ? [{ label: 'Users', to: '/settings/users' }, { label: 'Security log', to: '/settings/security' }] : []),
            { label: 'Sign out', onSelect: signOut },
          ]]"
        >
          <UButton :label="user.name" trailing-icon="i-lucide-chevron-down" color="neutral" variant="ghost" />
        </UDropdownMenu>
      </div>
    </header>
    <main class="flex-1 p-4 max-w-5xl mx-auto w-full">
      <slot />
    </main>
  </div>
</template>
