<script setup lang="ts">
const { user, clear } = useUserSession();
const route = useRoute();
const config = useRuntimeConfig();
const mobileOpen = ref(false);
const domain = computed(() => new URL(config.public.shortDomain).host);

const workspaceNav = computed(() => [
  { label: 'All links', icon: 'i-lucide-link', to: '/', active: route.path === '/' || route.path.startsWith('/links/') },
  { label: 'Campaigns', icon: 'i-lucide-megaphone', to: '/campaigns', active: route.path.startsWith('/campaigns') },
]);

const adminNav = computed(() => user.value?.role === 'admin'
  ? [
      { label: 'Users', icon: 'i-lucide-users', to: '/settings/users', active: route.path === '/settings/users' },
      { label: 'Security log', icon: 'i-lucide-shield-check', to: '/settings/security', active: route.path === '/settings/security' },
    ]
  : []);

const section = computed(() => [...workspaceNav.value, ...adminNav.value].find(item => item.active)?.label ?? 'All links');

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
  <div class="min-h-screen lg:py-2 lg:pr-2 lg:pl-60">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-default focus:p-3">Skip to content</a>
    <aside class="fixed inset-y-0 left-0 hidden w-60 flex-col bg-[var(--workspace-bg)] px-4 py-6 lg:flex">
      <NuxtLink to="/" aria-label="Linkyard home" class="px-2.5">
        <AppLogo />
      </NuxtLink>
      <div class="mx-1 mb-7 mt-7 flex items-center gap-2.5 rounded-lg border border-default bg-default/70 px-3 py-3 shadow-control">
        <UIcon name="i-lucide-building-2" class="size-4 shrink-0 text-muted" />
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-highlighted">
            My workspace
          </p><p class="truncate text-xs text-muted" :title="domain">
            {{ domain }}
          </p>
        </div>
      </div>
      <nav class="space-y-7">
        <div>
          <p class="px-2.5 pb-2 text-[11px] font-medium text-muted">
            Workspace
          </p>
          <UNavigationMenu :items="workspaceNav" orientation="vertical" />
        </div>
        <div v-if="adminNav.length">
          <p class="px-2.5 pb-2 text-[11px] font-medium text-muted">
            Administration
          </p>
          <UNavigationMenu :items="adminNav" orientation="vertical" />
        </div>
      </nav>
      <div class="mt-auto">
        <p class="flex items-center gap-1.5 px-2.5 py-4 text-[11px] text-muted">
          <UIcon name="i-lucide-server" class="size-3.5" />Self-hosted workspace
        </p>
        <UDropdownMenu
          v-if="user"
          :items="[[{ label: 'Sign out', icon: 'i-lucide-log-out', onSelect: signOut }]]"
          :content="{ align: 'start' }"
          class="w-full"
        >
          <UButton color="neutral" variant="ghost" class="w-full border-t border-default pt-4 pb-2 px-2.5 rounded-none" trailing-icon="i-lucide-chevron-down" :aria-label="`Account menu for ${user.name}`">
            <UAvatar :alt="user.name" size="xs" />
            <span class="min-w-0 flex-1 text-left">
              <span class="block truncate text-sm font-medium">{{ user.name }}</span>
              <span class="block text-xs font-normal text-muted">{{ user.role === 'admin' ? 'Administrator' : 'Member' }}</span>
            </span>
          </UButton>
        </UDropdownMenu>
      </div>
    </aside>
    <div class="min-h-[calc(100dvh-1rem)] bg-default lg:rounded-xl lg:border lg:border-default lg:shadow-panel">
      <header class="flex h-14 items-center justify-between gap-3 border-b border-default px-4 sm:px-8">
        <div class="flex min-w-0 items-center gap-2">
          <USlideover v-model:open="mobileOpen" title="Workspace" side="left">
            <UButton icon="i-lucide-menu" aria-label="Open navigation" color="neutral" variant="ghost" size="sm" class="lg:hidden" />
            <template #body>
              <nav class="space-y-7">
                <UNavigationMenu :items="workspaceNav" orientation="vertical" />
                <div v-if="adminNav.length">
                  <p class="px-2.5 pb-2 text-[11px] font-medium text-muted">
                    Administration
                  </p>
                  <UNavigationMenu :items="adminNav" orientation="vertical" />
                </div>
                <UButton label="Sign out" icon="i-lucide-log-out" color="neutral" variant="ghost" @click="signOut" />
              </nav>
            </template>
          </USlideover>
          <span class="hidden text-sm text-muted sm:inline">Workspace</span><span class="hidden text-dimmed sm:inline">/</span><span class="truncate text-sm font-medium text-highlighted">{{ section }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="hidden items-center gap-1.5 text-xs text-muted sm:flex"><UIcon name="i-lucide-globe" class="size-3.5" />{{ domain }}</span>
          <USeparator orientation="vertical" class="hidden h-4 sm:block" />
          <UColorModeButton size="sm" />
        </div>
      </header>
      <main id="main-content" class="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-8 sm:py-9 lg:px-10" tabindex="-1">
        <slot />
      </main>
    </div>
  </div>
</template>
