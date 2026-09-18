<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const { data } = await useApi<{ items: { id: string; name: string; slug: string; url: string }[] }>('/api/workspaces');
</script>

<template>
  <div>
    <div class="mb-7">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        Choose workspace
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ data?.items?.length ? 'You belong to more than one.' : 'You do not belong to a workspace yet.' }}
      </p>
    </div>
    <ul class="divide-y divide-default rounded-lg border border-default">
      <li v-for="w in data?.items ?? []" :key="w.id">
        <a :href="w.url" class="flex items-center gap-3 p-4 hover:bg-muted">
          <UIcon name="i-lucide-building-2" class="size-4 shrink-0 text-muted" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-highlighted">{{ w.name }}</span>
            <span class="block truncate text-xs text-muted">{{ w.slug }}</span>
          </span>
        </a>
      </li>
    </ul>
    <UButton to="/workspaces/new" label="Create a workspace" variant="ghost" block class="mt-4" />
  </div>
</template>
