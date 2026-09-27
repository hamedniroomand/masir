<script setup lang="ts">
const { current, can } = useCurrentWorkspace();

const bookmarklet = computed(() => {
  const base = current.value?.url ?? '';
  return `javascript:location.href='${base}/links/new?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)`;
});
</script>

<template>
  <div v-if="can('links.manage')" class="surface space-y-3 rounded-lg border border-default p-4">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-highlighted">
        Quick create
      </h3>
      <NuxtLink to="/links/new" class="text-xs font-medium text-primary hover:underline">
        Open form <UIcon name="i-lucide-arrow-right" class="inline size-3" />
      </NuxtLink>
    </div>
    <p class="text-xs text-muted">
      Drag this button to your bookmarks bar. Press it on any page to open the create form with that URL and title filled in.
    </p>
    <div class="pt-1">
      <a
        :href="bookmarklet"
        class="inline-flex items-center gap-2 rounded-lg border border-default bg-muted/40 px-3 py-2 text-xs font-medium text-highlighted shadow-xs hover:bg-muted/70"
        @click.prevent
      >
        <UIcon name="i-lucide-bookmark" class="size-4 text-primary" />Shorten with Masir
      </a>
    </div>
  </div>
</template>
