<script setup lang="ts">
const { user, clear } = useUserSession();
const route = useRoute();
const config = useRuntimeConfig();
const mobileOpen = ref(false);
const domain = computed(() => new URL(config.public.shortDomain).host);
const navigation = computed(() => [
  { label: 'My links', icon: 'i-lucide-link', to: '/', active: route.path === '/' || route.path.startsWith('/links/') },
  ...(user.value?.role === 'admin'
    ? [
        { label: 'Users', icon: 'i-lucide-users', to: '/settings/users' },
        { label: 'Security log', icon: 'i-lucide-shield-check', to: '/settings/security' },
      ]
    : []),
]);
const section = computed(() => route.path === '/settings/users' ? 'Users' : route.path === '/settings/security' ? 'Security log' : 'My links');
watch(() => route.fullPath, () => {
  mobileOpen.value = false;
});

const showError = useErrorToast();

async function signOut() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' });
  }
  catch (e) {
    showError(e);
  }
  await clear();
  await navigateTo('/login');
}
</script>

<template>
  <div class="min-h-screen lg:pl-64">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-default focus:p-3">Skip to content</a>
    <aside class="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-default bg-default lg:flex">
      <NuxtLink to="/" aria-label="Linkyard home" class="px-6 py-7">
        <AppLogo />
      </NuxtLink>
      <div class="mx-4 mb-7 flex items-center gap-3 rounded-xl border border-default bg-muted/50 p-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
          <UIcon name="i-lucide-building-2" class="size-5 text-muted" />
        </div>
        <div class="min-w-0">
          <p class="text-sm font-medium text-highlighted">
            Company workspace
          </p><p class="truncate text-xs text-muted" :title="domain">
            {{ domain }}
          </p>
        </div>
      </div>
      <div class="px-4">
        <p class="mb-2 px-3 text-xs font-medium text-muted">
          Workspace
        </p>
        <UNavigationMenu :items="navigation" orientation="vertical" />
      </div>
      <div class="mt-auto p-4">
        <div class="mb-4 rounded-xl bg-muted/60 p-4">
          <UIcon name="i-lucide-server" class="mb-2 size-5 text-primary" />
          <p class="text-sm font-medium text-highlighted">
            Hosted by your company
          </p>
          <p class="mt-1 text-xs leading-5 text-muted">
            Your links and click data stay on your infrastructure.
          </p>
        </div>
        <div v-if="user" class="flex items-center gap-3 border-t border-default pt-4">
          <UAvatar :alt="user.name" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ user.name }}
            </p><p class="text-xs text-muted">
              {{ user.role === 'admin' ? 'Administrator' : 'Member' }}
            </p>
          </div>
          <UButton icon="i-lucide-log-out" aria-label="Sign out" color="neutral" variant="ghost" @click="signOut" />
        </div>
      </div>
    </aside>
    <header class="flex h-17 items-center justify-between gap-3 border-b border-default bg-default px-4 sm:px-8">
      <div class="flex items-center gap-3">
        <USlideover v-model:open="mobileOpen" title="Workspace" side="left">
          <UButton icon="i-lucide-menu" aria-label="Open navigation" color="neutral" variant="ghost" class="lg:hidden" />
          <template #body>
            <AppLogo class="mb-8" /><UNavigationMenu :items="navigation" orientation="vertical" @click="mobileOpen = false" /><UButton class="mt-8" label="Sign out" icon="i-lucide-log-out" color="neutral" variant="ghost" @click="signOut" />
          </template>
        </USlideover>
        <span class="hidden text-sm text-muted sm:inline">Workspace</span><UIcon name="i-lucide-chevron-right" class="hidden size-3 text-dimmed sm:block" /><span class="text-sm font-medium">{{ section }}</span>
      </div>
      <div class="flex items-center gap-3">
        <UBadge label="Self-hosted" icon="i-lucide-server" color="neutral" variant="subtle" class="hidden sm:inline-flex" /><UColorModeButton />
      </div>
    </header>
    <main id="main-content" class="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-10 lg:px-10" tabindex="-1">
      <slot />
    </main>
  </div>
</template>
